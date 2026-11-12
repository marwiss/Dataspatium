// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The review before sharing: everything in a dataset that may be personal data is listed (data/share-scan), and for each
 * the user chooses what happens in the copy that leaves the app. The datasets themselves are never changed. In an IFC model the
 * review looks inside the file; changing it there needs the app's Python with IfcOpenShell, so without Python running the dialog
 * offers to keep or to stop, says why, and can start Python.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/share/review', ['ui/base', 'data/share-scan'], (base, shareScan) => {
    const { h, t, i18n } = base;
    const SEP = '\u0000';

    /**
     * Column findings for one dataset.
     * @param {string} id @returns {Promise<any[]>}
     */
    const findings = (id) => shareScan.columnFindings(id);

    /** What each dataset would bring: a Map of id to findings, only for datasets with something to show. */
    async function scan(ids) {
      const map = new Map();
      for (const id of ids) {
        try {
          const found = await shareScan.inspect(id);
          if (found.columns.length || found.parts.length) map.set(id, found);
        } catch (err) { D.log('review', 'scan failed', id, err); }
      }
      return map;
    }
    function partLabel(p) {
      const n = i18n.formatNumber(p.count);
      const names = (p.names || []).join(', ');
      switch (p.kind) {
        case 'text': return t('review.part.text', { column: p.column, n });
        case 'side': return i18n.has('review.part.side.' + p.table) ? t('review.part.side.' + p.table, { n }) : t('review.part.side', { table: p.table, n });
        default: return t('review.part.' + p.kind, { n, names });
      }
    }
    function picker(label, choices, start, onChange, attrs) {
      const sel = /** @type {any} */ (h('dm-select', Object.assign({ label }, attrs || {})));
      sel.options = choices.map((c) => ({ value: c, label: t('review.choice.' + c) }));
      sel.value = start;
      sel.addEventListener('change', () => onChange(sel.value));
      return sel;
    }

    /**
     * Why an IFC model's parts can only be kept, with the button that starts Python (the person's action); once it runs, the
     * pickers get all their choices and start where they would have. @param {Array<{sel: any, key: string, part: any}>} pickers
     * @param {Map<string, string>} choices
     */
    function pythonBlock(pickers, choices) {
      const note = h('p', { class: 'dm-help dm-small', 'data-review-ifc-python': '', text: t('review.ifc.python') });
      const btn = /** @type {any} */ (D.require('ui/basic').button({ label: t('review.ifc.start'), icon: 'play', size: 'sm', title: t('review.ifc.start.hint'), 'data-review-ifc-start': '',
        onClick: async () => {
          if (btn.loading) return;
          btn.loading = true;
          try {
            await D.require('data/python-bridge').bridge.start();
            for (const { sel, key, part } of pickers) {
              sel.options = part.withPython.choices.map((c) => ({ value: c, label: t('review.choice.' + c) }));
              sel.value = part.withPython.start;
              choices.set(key, part.withPython.start);
            }
            note.textContent = t('review.ifc.started');
            btn.remove();
          } catch (err) {
            D.log('review', 'python start failed', err);
            note.textContent = t('review.ifc.start.failed', { error: String((err && err.message) || err) });
            btn.loading = false;
          }
        } }));
      return h('div', { class: 'dm-stack-xs' }, note, h('div', null, btn));
    }

    /**
     * The dialog. Resolves with { transform, extras, findings } (transform may be empty) or null when the user cancelled.
     * Nothing is shown when no dataset holds anything to decide on. With `options.include` (a bundle) the charts, dashboards,
     * notebooks, templates and scripts that would follow are scanned too, and `extras` maps their paths to the choices.
     * @param {any} ctx @param {string[]} ids @param {{include?: any}} [options]
     */
    async function review(ctx, ids, options = {}) {
      const found = await scan(ids);
      let others = [];
      if (options.include) { try { others = await shareScan.extras(ids, options.include); } catch (err) { D.log('review', 'extras failed', err); } }
      if (!found.size && !others.length) return { transform: {}, extras: {}, findings: found };
      const names = new Map(ctx.store.get().datasets.map((d) => [d.id, d.name]));
      /** @type {Map<string, string>} */
      const choices = new Map();
      /** The parts by key, for what a choice carries along (the pieces of a model's free text). */
      const partsByKey = new Map();
      const ifcPickers = [];
      const rows = [];
      for (const [id, list] of found) {
        rows.push(h('h4', { text: names.get(id) || id }));
        for (const f of list.columns) {
          const key = id + SEP + 'column' + SEP + f.column;
          const offer = shareScan.columnChoices(f);
          choices.set(key, offer.start);
          rows.push(picker(`${t('review.kind.' + f.kind)}: ${f.column}`, offer.choices, offer.start, (v) => choices.set(key, v)));
        }
        for (const p of list.parts) {
          const key = id + SEP + 'part' + SEP + p.id;
          choices.set(key, p.start);
          partsByKey.set(key, p);
          const sel = picker(partLabel(p), p.choices, p.start, (v) => choices.set(key, v), p.kind.startsWith('ifc.') ? { 'data-review-ifc': p.id.slice(4) } : null);
          if (p.needsPython) ifcPickers.push({ sel, key, part: p });
          rows.push(sel);
        }
      }
      if (ifcPickers.length) rows.push(pythonBlock(ifcPickers, choices));
      /** @type {Record<string, string>} */
      const extras = {};
      if (others.length) {
        rows.push(h('h4', { text: t('review.extras') }));
        for (const x of others) {
          extras[x.path] = x.start;
          rows.push(picker(t('review.extra.' + x.kind, { name: x.name, n: i18n.formatNumber(x.count) }), x.choices, x.start, (v) => { extras[x.path] = v; }));
        }
      }
      const body = h('div', { class: 'dm-stack' },
        h('p', { class: 'dm-help', text: t('review.help') }),
        h('div', { class: 'dm-stack-sm' }, rows),
        h('p', { class: 'dm-help dm-small', text: t('review.note') }),
        h('p', { class: 'dm-help dm-small', text: t('review.note.log') }),
        h('p', { class: 'dm-help dm-small', text: t('review.note.extras') }));
      const ok = await ctx.ui.dialog.open({ title: t('review.title'), help: 'dela#granskning-före-delning', body, size: 'lg', actions: [{ label: t('common.cancel'), value: false }, { label: t('review.continue'), variant: 'primary', value: true, primary: true }] });
      if (ok !== true) return null;
      const transform = {};
      for (const [key, choice] of choices) {
        if (choice === 'keep') continue;
        const [id, type, what] = key.split(SEP);
        const tr = transform[id] || (transform[id] = { drop: [], hash: [], mask: [], side: {} });
        if (type === 'column') { tr[choice].push(what); continue; }
        const at = what.indexOf(':');
        const group = at > 0 ? what.slice(0, at) : what;
        const name = at > 0 ? what.slice(at + 1) : '';
        if (group === 'text') tr[choice === 'drop' ? 'drop' : 'mask'].push(name);
        else if (group === 'side') tr.side[name] = choice;
        else if (group === 'ifc') {
          const ifc = tr.ifc || (tr.ifc = {});
          ifc[name] = choice;
          const part = partsByKey.get(key);
          if (part && part.matches) ifc.matches = part.matches;
        }
        else tr[group] = true;
      }
      return { transform, extras, findings: found };
    }

    /**
     * Whether to go on when nothing can be changed in what leaves, as when a workspace is pushed to GitHub: a pseudonymised
     * copy could not be fetched back. Shows what is there; nothing to show means yes.
     * @param {any} ctx @param {string[]} ids @returns {Promise<boolean>}
     */
    async function warn(ctx, ids) {
      const found = await scan(ids);
      if (!found.size) return true;
      const names = new Map(ctx.store.get().datasets.map((d) => [d.id, d.name]));
      const body = h('div', { class: 'dm-stack' },
        h('p', { text: t('review.warn.help') }),
        h('ul', { class: 'dm-stack-xs' }, Array.from(found, ([id, list]) => h('li', { text: `${names.get(id) || id}: ${list.columns.map((f) => f.column).concat(list.parts.map(partLabel)).join(', ')}` }))));
      const ok = await ctx.ui.dialog.open({ title: t('review.warn.title'), help: 'dela#granskning-före-delning', body, size: 'lg', actions: [{ label: t('common.cancel'), value: false }, { label: t('review.continue'), variant: 'primary', value: true, primary: true }] });
      return ok === true;
    }

    /**
     * The material behind a building model on its way to the model's server (decision F43 b, step 5): what leaves, the reminder
     * that people and number plates on the pictures are personal data, and the choice for the pictures' positions and times
     * (dropped from the copy unless the person keeps them: the brief's lines and the files' EXIF). Resolves with
     * { places: 'keep' | 'drop' } or null when the person cancels.
     * With `kind: 'findings'` the same review is for a check's findings on their way to the server as issues with their photos.
     * @param {any} ctx @param {{pictures: number, places: number, server: string, project: string, kind?: 'material'|'findings'}} info
     */
    function placesPicker(label, start, onChange) {
      const sel = /** @type {any} */ (h('dm-select', { label, 'data-review-material-places': '' }));
      sel.options = [{ value: 'drop', label: t('review.material.remove') }, { value: 'keep', label: t('review.choice.keep') }];
      sel.value = start;
      sel.addEventListener('change', () => onChange(sel.value));
      return sel;
    }
    async function material(ctx, info) {
      let places = 'drop';
      const dialog = (ctx && ctx.ui && ctx.ui.dialog) || D.require('ui/overlays').dialog;
      const body = h('div', { class: 'dm-stack', 'data-review-material': '' },
        h('p', { text: t(info.kind === 'findings' ? 'review.findings.help' : 'review.material.help', { n: i18n.formatNumber(info.pictures || 0), project: String(info.project || ''), server: String(info.server || '') }) }),
        h('p', { class: 'dm-help dm-small', text: t('review.material.people') }),
        info.places ? placesPicker(t('review.material.places', { n: i18n.formatNumber(info.places) }), places, (v) => { places = v === 'keep' ? 'keep' : 'drop'; }) : null,
        info.places ? h('p', { class: 'dm-help dm-small', text: t('review.material.places.help') }) : null);
      const ok = await dialog.open({ title: t(info.kind === 'findings' ? 'review.findings.title' : 'review.material.title'), help: 'dela#granskning-före-delning', body, actions: [{ label: t('common.cancel'), value: false }, { label: t('review.continue'), variant: 'primary', value: true, primary: true }] });
      return ok === true ? { places } : null;
    }

    /** A short line for the log: what was changed in the copy. */
    function summary(transform) {
      let hash = 0; let drop = 0; let other = 0;
      for (const tr of Object.values(transform || {})) {
        hash += (tr.hash || []).length; drop += (tr.drop || []).length;
        other += (tr.mask || []).length + Object.keys(tr.side || {}).length + ['originals', 'pictures', 'positions', 'comments', 'authors'].filter((k) => tr[k]).length;
        other += shareScan.IFC_PARTS.filter((k) => tr.ifc && (tr.ifc[k] === 'hash' || tr.ifc[k] === 'remove')).length;
      }
      if (!hash && !drop && !other) return '';
      return other ? `${t('review.applied', { hash, drop })} ${t('review.applied.more', { n: other })}` : t('review.applied', { hash, drop });
    }

    return { findings, scan, review, warn, material, summary, PHONE_NAME: shareScan.PHONE_NAME };
  });
})();
