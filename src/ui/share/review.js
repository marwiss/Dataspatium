// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The review before sharing: everything in a dataset that may be personal data is listed (data/share-scan), and for each
 * the user chooses what happens in the copy that leaves the app. The datasets themselves are never changed.
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
    function picker(label, choices, start, onChange) {
      const sel = /** @type {any} */ (h('dm-select', { label }));
      sel.options = choices.map((c) => ({ value: c, label: t('review.choice.' + c) }));
      sel.value = start;
      sel.addEventListener('change', () => onChange(sel.value));
      return sel;
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
          rows.push(picker(partLabel(p), p.choices, p.start, (v) => choices.set(key, v)));
        }
      }
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

    /** A short line for the log: what was changed in the copy. */
    function summary(transform) {
      let hash = 0; let drop = 0; let other = 0;
      for (const tr of Object.values(transform || {})) {
        hash += (tr.hash || []).length; drop += (tr.drop || []).length;
        other += (tr.mask || []).length + Object.keys(tr.side || {}).length + ['originals', 'pictures', 'positions', 'comments', 'authors'].filter((k) => tr[k]).length;
      }
      if (!hash && !drop && !other) return '';
      return other ? `${t('review.applied', { hash, drop })} ${t('review.applied.more', { n: other })}` : t('review.applied', { hash, drop });
    }

    return { findings, scan, review, warn, summary, PHONE_NAME: shareScan.PHONE_NAME };
  });
})();
