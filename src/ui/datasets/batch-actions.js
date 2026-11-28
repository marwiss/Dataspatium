// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Actions on one or several datasets: organise (folder and tags), move by drag and drop, the tools of the dataset tree, which
 * only Hantera shows (move folders and datasets to the trash and back, remove them for good, cut, copy and paste, rename;
 * ui/dataset-list), and, in Hantera, the batch
 * dialog for the selected datasets: what they can do together (one map, one table, one collection), organise, delete, export each in
 * its own form, bundle, refresh from the API and run another dataset's recipe on them.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/batch-actions', ['ui/base', 'ui/share/bundle', 'ui/dataset-list'], (base, share, tree) => {
    const { h, t, i18n } = base;

    const chosenOf = (ctx, ids) => { const set = new Set(ids); return ctx.store.get().datasets.filter((d) => set.has(d.id)); };
    const fail = (ctx, err) => { ctx.shell.log(String((err && err.message) || err), 'error'); ctx.ui.toast.show(String((err && err.message) || err), { kind: 'error' }); };
    const done = (ctx, text) => { ctx.shell.log(text, 'ok'); ctx.ui.toast.show(text, { kind: 'ok' }); };

    // ---- the tools of the dataset tree: folders are paths, so a folder goes with its datasets ----
    const within = (path, folder) => path === folder || path.startsWith(folder + '/');
    const parentOf = (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
    const leafOf = (path) => path.slice(path.lastIndexOf('/') + 1);
    const joinPath = (a, b) => (a ? a + '/' + b : b);
    /** Every folder in use: the datasets' paths with their parents, and the empty folders. */
    const takenFolders = (ctx, list) => ctx.services.datasets.folderPaths(list.concat(tree.folders.list().map((folder) => ({ folder }))));
    /** "2 mappar och 3 datamängder", leaving out what there is none of. */
    function amount(parts) {
      const said = parts.filter(([, n]) => n > 0).map(([key, n]) => t('datasets.tree.n.' + key, { n: i18n.formatNumber(n) }));
      return said.length > 1 ? t('datasets.tree.and', { a: said.slice(0, -1).join(', '), b: said[said.length - 1] }) : said[0] || '';
    }
    /** The name of a copy: "Namn (kopia)", "Namn (kopia 2)" … */
    const copyName = (name, n) => (n > 1 ? t('datasets.tree.copy.name.n', { name, n }) : t('datasets.tree.copy.name', { name }));

    /**
     * What a paste does, before anything changes: where each dataset goes (with a copy's name when it lands beside its
     * original), which folders are copied or moved where, and the folders refused because they would go into themselves.
     * A folder copied where its name is taken gets a copy's name; a folder moved there joins the one that is there.
     * @param {any[]} list all datasets @param {{mode: 'copy'|'cut', ids: string[], folders: string[]}} clip @param {string} target
     * @param {string[]} taken every folder path in use @param {(name: string, n: number) => string} nameOf
     * @returns {{jobs: Array<{id: string, folder: string, name: string|null}>, folders: Array<{from: string, to: string}>, refused: string[]}}
     */
    function pastePlan(list, clip, target, taken, nameOf) {
      const jobs = []; const moved = []; const refused = [];
      const used = new Set(taken);
      const seen = new Set();
      for (const from of clip.folders) {
        if (clip.mode === 'cut' && within(target, from)) { refused.push(from); continue; }
        let to = joinPath(target, leafOf(from));
        if (clip.mode === 'copy') for (let n = 1; used.has(to); n++) to = joinPath(target, nameOf(leafOf(from), n));
        if (clip.mode === 'cut' && to === from) continue;
        used.add(to);
        moved.push({ from, to });
        for (const d of list) {
          const f = d.folder || '';
          if (within(f, from) && !seen.has(d.id)) { seen.add(d.id); jobs.push({ id: d.id, folder: to + f.slice(from.length), name: null }); }
        }
      }
      for (const id of clip.ids) {
        const d = list.find((x) => x.id === id);
        if (!d || seen.has(id)) continue;
        seen.add(id);
        const beside = (d.folder || '') === target;
        if (clip.mode === 'cut' && beside) continue;
        jobs.push({ id, folder: target, name: clip.mode === 'copy' && beside ? nameOf(d.name, 1) : null });
      }
      return { jobs, folders: moved, refused };
    }

    /**
     * Ta bort: folders with everything in them and datasets go to the trash of the place where they lie, without a question
     * (F131 b). The data stays, marked with the time and the folder (data/datasets.trash); the log says what went, and the toast's
     * Ångra puts it all back where it was, as Återställ does.
     * @param {any} ctx @param {{ids: string[], folders: string[]}} units @returns {Promise<boolean>} whether anything was moved
     */
    async function removeUnits(ctx, units) {
      const { ui, services, store, shell } = ctx;
      const list = store.get().datasets;
      const inFolder = (d) => units.folders.find((f) => within(d.folder || '', f));
      const alone = list.filter((d) => units.ids.includes(d.id) && !inFolder(d));
      const withFolder = list.filter((d) => inFolder(d));
      const gone = takenFolders(ctx, list).filter((p) => units.folders.some((f) => within(p, f)));
      if (!alone.length && !withFolder.length && !gone.length) return false;
      const batch = 'tr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const at = new Date().toISOString();
      let n = 0;
      try {
        for (const f of units.folders) {
          n += (await services.datasets.trash(withFolder.filter((d) => inFolder(d) === f).map((d) => d.id), { batch, at, root: f })).length;
          tree.folders.trash(f, batch, at);
        }
        n += (await services.datasets.trash(alone.map((d) => d.id), { batch, at, root: '' })).length;
      } catch (err) { fail(ctx, err); }
      const moved = new Set(alone.concat(withFolder).map((d) => d.id));
      store.set({ selectedIds: (store.get().selectedIds || []).filter((id) => !moved.has(id)) });
      const what = amount([['folders', units.folders.length], ['datasets', n]]);
      const names = units.folders.concat(alone.map((d) => d.name));
      const inside = amount([['subfolders', gone.length - 1], ['datasets', n]]);
      const text = units.folders.length === 1 && !alone.length ? (inside ? t('datasets.trash.moved.folder', { name: units.folders[0], what: inside }) : t('datasets.trash.moved.folder.empty', { name: units.folders[0] }))
        : !units.folders.length && n === 1 ? t('datasets.trash.moved.one', { name: alone[0].name })
          : t('datasets.trash.moved', { what, names: names.join(', ') });
      shell.log(text, 'ok');
      ui.toast.show(text, { kind: 'ok', timeout: 10000, action: { label: t('common.undo'), onClick: () => { undoRemove(ctx, batch).catch((err) => fail(ctx, err)); } } });
      return true;
    }
    /** Ångra after Ta bort: what that removal moved to the trash comes back where it was. @param {any} ctx @param {string} batch */
    async function undoRemove(ctx, batch) {
      const ids = (await ctx.services.datasets.list('trash')).filter((d) => d.trashed && d.trashed.batch === batch).map((d) => d.id);
      const back = await ctx.services.datasets.restore(ids);
      tree.folders.untrash(batch, null, true);
      done(ctx, back.length ? t('datasets.trash.undone', { what: amount([['datasets', back.length]]) }) : t('datasets.trash.undone.folders'));
      return back.length;
    }
    /** What a unit in the trash holds: the datasets in it, and how many folders it is. @param {any} ctx @param {{ids: string[], roots: Array<{batch: string, path: string}>}} unit */
    async function trashContents(ctx, unit) {
      const trash = await ctx.services.datasets.list('trash');
      const ids = new Set(unit.ids);
      for (const r of unit.roots) for (const d of trash) { const m = d.trashed || {}; if (m.batch === r.batch && m.root && within(d.folder || '', r.path)) ids.add(d.id); }
      return trash.filter((d) => ids.has(d.id));
    }
    /**
     * Återställ: datasets and folders from the trash back in the folder they lay in (the folder comes back if it is gone).
     * @param {any} ctx @param {{ids: string[], roots: Array<{batch: string, path: string}>}} unit @returns {Promise<boolean>}
     */
    async function restoreUnits(ctx, unit) {
      const chosen = await trashContents(ctx, unit);
      let back = [];
      try { back = await ctx.services.datasets.restore(chosen.map((d) => d.id)); } catch (err) { fail(ctx, err); }
      for (const r of unit.roots) tree.folders.untrash(r.batch, r.path, true);
      const one = !unit.roots.length && back.length === 1 ? back[0] : null;
      done(ctx, one ? t('datasets.trash.restored.one', { name: one.name, folder: one.folder || t('datasets.storage.title') })
        : t('datasets.trash.restored', { what: amount([['folders', unit.roots.length], ['datasets', back.length]]) }));
      return true;
    }
    /**
     * Ta bort för gott: from the trash, after a question that says what goes. Each dataset is deleted the usual way
     * (data/datasets.remove), so the store, the log and other tabs follow.
     * @param {any} ctx @param {{ids: string[], roots: Array<{batch: string, path: string}>}} unit @returns {Promise<boolean>}
     */
    async function purgeUnits(ctx, unit) {
      const { ui, services } = ctx;
      const chosen = await trashContents(ctx, unit);
      const what = unit.roots.length === 1 && !unit.ids.length ? leafOf(unit.roots[0].path) : chosen.length === 1 && !unit.roots.length ? chosen[0].name : amount([['folders', unit.roots.length], ['datasets', chosen.length]]);
      if (!(await ui.dialog.confirm(t('datasets.trash.purge.confirm', { what }), { okLabel: t('datasets.trash.purge'), danger: true }))) return false;
      let n = 0;
      for (const d of chosen) { try { await services.datasets.remove(d.id); n++; } catch (err) { fail(ctx, err); } }
      for (const r of unit.roots) tree.folders.untrash(r.batch, r.path, false);
      done(ctx, t('datasets.trash.purged', { what }));
      return n > 0 || unit.roots.length > 0;
    }
    /** Töm papperskorgen: everything in it goes for good, after a question that says how much. @param {any} ctx @returns {Promise<boolean>} */
    async function emptyTrash(ctx) {
      const { ui, services } = ctx;
      const trash = await services.datasets.list('trash');
      const roots = new Set(trash.filter((d) => d.trashed && d.trashed.root).map((d) => d.trashed.batch + '|' + d.trashed.root));
      for (const r of tree.folders.trashed()) roots.add(r.batch + '|' + r.root);
      if (!trash.length && !roots.size) return false;
      const size = trash.reduce((n, d) => n + services.datasets.storedBytes(d), 0);
      const what = amount([['folders', roots.size], ['datasets', trash.length]]);
      if (!(await ui.dialog.confirm(t('datasets.trash.empty.confirm', { what, size: i18n.formatBytes(size) }), { okLabel: t('datasets.trash.empty.action'), danger: true }))) return false;
      let n = 0;
      for (const d of trash) { try { await services.datasets.remove(d.id); n++; } catch (err) { fail(ctx, err); } }
      tree.folders.untrash(null, null, false);
      done(ctx, t('datasets.trash.emptied', { what: amount([['folders', roots.size], ['datasets', n]]), size: i18n.formatBytes(size) }));
      return true;
    }

    /**
     * Paste what was cut (moved) or copied (each dataset duplicated with its file) into a folder ('' is the root).
     * @param {any} ctx @param {{mode: 'copy'|'cut', ids: string[], folders: string[]}} clip @param {string} target
     * @returns {Promise<string[]>} the ids of the datasets pasted (the copies when copying)
     */
    async function paste(ctx, clip, target) {
      const { services, store, ui } = ctx;
      const list = store.get().datasets;
      const into = services.datasets.normalizeFolder(target);
      const plan = pastePlan(list, clip, into, takenFolders(ctx, list), copyName);
      for (const f of plan.refused) ui.toast.show(t('datasets.tree.into.itself', { name: f }), { kind: 'warn' });
      const out = [];
      try {
        for (const job of plan.jobs) {
          if (clip.mode === 'cut') { await services.datasets.updateMeta(job.id, { folder: job.folder }); out.push(job.id); }
          else {
            const d = list.find((x) => x.id === job.id);
            const copy = await services.datasets.duplicate(job.id, { folder: job.folder, name: job.name || d.name });
            out.push(copy.id);
          }
        }
      } catch (err) { fail(ctx, err); }
      for (const f of plan.folders) { if (clip.mode === 'cut') tree.folders.move(f.from, f.to); else tree.folders.copy(f.from, f.to); }
      if (out.length || plan.folders.length) {
        const what = amount([['folders', plan.folders.length], ['datasets', out.length]]);
        done(ctx, t(clip.mode === 'cut' ? 'datasets.tree.moved' : 'datasets.tree.copied', { what, folder: into || t('datasets.tree.root') }));
      }
      return out;
    }

    /**
     * A new name for one dataset or one folder (the folder's last part; its datasets and subfolders follow).
     * @param {any} ctx @param {{ids: string[], folders: string[]}} unit @param {string} name @returns {Promise<boolean>}
     */
    async function renameUnit(ctx, unit, name) {
      const { services, store, ui } = ctx;
      const value = String(name || '').trim().replace(/\s+/g, ' ');
      if (!value) return false;
      const list = store.get().datasets;
      try {
        if (unit.ids.length) {
          const d = list.find((x) => x.id === unit.ids[0]);
          if (!d || d.name === value) return false;
          await services.datasets.updateMeta(d.id, { name: value });
          ctx.shell.log(t('datasets.renamed'), 'ok');
          return true;
        }
        const from = unit.folders[0];
        const to = services.datasets.normalizeFolder(joinPath(parentOf(from), value.replace(/\//g, ' ')));
        if (!to || to === from) return false;
        if (takenFolders(ctx, list).includes(to)) { ui.toast.show(t('datasets.tree.folder.exists', { name: to }), { kind: 'warn' }); return false; }
        for (const d of list) {
          const f = d.folder || '';
          if (within(f, from)) await services.datasets.updateMeta(d.id, { folder: to + f.slice(from.length) });
        }
        tree.folders.move(from, to);
        done(ctx, t('datasets.tree.folder.renamed', { from, to }));
        return true;
      } catch (err) { fail(ctx, err); return false; }
    }

    const actionsOf = new WeakMap();
    /** The work behind the tree's tools for this context (ui/dataset-list `actions`), which Hantera alone gives its tree. */
    function treeActions(ctx) {
      if (!actionsOf.has(ctx)) {
        actionsOf.set(ctx, {
          remove: (units) => removeUnits(ctx, units), paste: (clip, target) => paste(ctx, clip, target), rename: (unit, name) => renameUnit(ctx, unit, name),
          restore: (unit) => restoreUnits(ctx, unit), purge: (unit) => purgeUnits(ctx, unit), empty: () => emptyTrash(ctx),
        });
      }
      return actionsOf.get(ctx);
    }
    /**
     * The tree every mode shows (the shell's defaults for ui/dataset-list): check boxes on the store's selection, for the mode's
     * own actions. The tools that change the folders (Ny mapp, Byt namn, Klipp ut, Kopiera, Klistra in, Flytta, Ta bort, their
     * keys, the snabbmeny and dragging) are Hantera's alone, which adds `actions` and `onMove` (B-81.4).
     */
    function treeOptions(ctx) {
      return { multi: true, selectedIds: ctx.store.get().selectedIds || [], onToggle: (ids) => ctx.store.set({ selectedIds: ids }), trash: ctx.store.get().trash || [] };
    }

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
      if (spatial.every(Boolean) && D.require('platform/tier').shows('chart:map')) out.push({ id: 'map', label: 'datasets.batch.map', hint: 'datasets.batch.map.hint', icon: 'map' });
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
      const folders = takenFolders(ctx, ctx.store.get().datasets);
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
        // Folders chosen whole go to the trash with their subfolders, empty ones too, as with the tree's own Ta bort.
        else if (choice === 'delete') await removeUnits(ctx, tree.selectionUnits(store.get().datasets, ids));
        else if (choice === 'export') {
          const files = {};
          for (const d of chosen) await exportWhole(ctx, d, files);
          const blob = await D.require('platform/storage/zip').createZip(files, { level: 6 });
          services.files.download(blob, services.files.safeName(t('datasets.batch.export.file'), 'zip'));
          done(ctx, t('datasets.batch.exported', { n: chosen.length }));
        } else if (choice === 'refresh') {
          const api = chosen.filter((d) => d.source && (d.source.kind === 'api' || d.source.kind === 'bridge'));
          if (!api.length) { ui.toast.show(t('datasets.batch.refresh.none'), { kind: 'warn' }); return; }
          // api/runner loads with the group 'families' (src/boot.js), which the start does without.
          const runner = await D.ensure(['families'], () => D.require('api/runner'));
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
        // A step that fails (one the tier hides among them) stops the replay on that dataset, and the log says why.
        try { const failed = (await recipes.replay(d.id, steps)).find((r) => !r.ok); if (failed) throw new Error(failed.error); good++; shell.log(t('datasets.batch.recipe.one', { name: d.name }), 'ok'); }
        catch (err) { shell.log(`${d.name}: ${(err && err.message) || err}`, 'error'); }
      }
      done(ctx, t('datasets.batch.recipe.done', { ok: good, n: targets.length }));
    }

    return { abilities, open, organize, move, removeUnits, undoRemove, restoreUnits, purgeUnits, emptyTrash, paste, renameUnit, pastePlan, treeActions, treeOptions };
  });
})();
