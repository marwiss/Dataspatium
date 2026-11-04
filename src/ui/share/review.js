// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The review before sharing: columns that look like personal data (identity numbers, e-mail addresses, phone
 * numbers) are listed per dataset, and for each the user keeps it, pseudonymises it or drops it in the copy that
 * leaves the app. The datasets themselves are never changed; data/datasets.exportBytesTransformed() applies the
 * choices to the exported file.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/share/review', ['ui/base', 'data/rules', 'data/datasets'], (base, rules, datasets) => {
    const { h, t } = base;
    const PHONE_NAME = /telefon|mobil(?!itet)|phone|puhelin|s[ií]mi|^tlf$|\btel\b|^gsm$|farsimi|handy/i;
    const SEP = '\u0000';

    /**
     * Findings for one dataset.
     * @param {string} id
     * @returns {Promise<Array<{column: string, kind: 'identifier'|'email'|'phone', detail?: string}>>}
     */
    async function findings(id) {
      const out = [];
      const columns = await datasets.columns(id);
      for (const r of await rules.suggest(id)) {
        if (r.type === 'identifier' && !out.some((f) => f.column === r.column)) out.push({ column: r.column, kind: 'identifier', detail: r.kind });
        else if (r.type === 'format' && r.format === 'email' && !out.some((f) => f.column === r.column)) out.push({ column: r.column, kind: 'email' });
      }
      for (const c of columns) {
        if (c.type === 'text' && PHONE_NAME.test(c.name) && !out.some((f) => f.column === c.name)) out.push({ column: c.name, kind: 'phone' });
      }
      return out;
    }

    /** Findings for several datasets: a Map of id to findings, only for datasets with something to show. */
    async function scan(ids) {
      const map = new Map();
      for (const id of ids) {
        try { const f = await findings(id); if (f.length) map.set(id, f); } catch (err) { D.log('review', 'scan failed', id, err); }
      }
      return map;
    }

    /**
     * The dialog. Resolves with { transform, findings } (transform may be empty) or null when the user cancelled.
     * Nothing is shown when no dataset has findings.
     * @param {any} ctx @param {string[]} ids
     */
    async function review(ctx, ids) {
      const found = await scan(ids);
      if (!found.size) return { transform: {}, findings: found };
      const names = new Map(ctx.store.get().datasets.map((d) => [d.id, d.name]));
      /** @type {Map<string, string>} */
      const choices = new Map();
      const rows = [];
      for (const [id, list] of found) {
        rows.push(h('h4', { text: names.get(id) || id }));
        for (const f of list) {
          const key = id + SEP + f.column;
          choices.set(key, f.kind === 'identifier' ? 'hash' : 'keep');
          const sel = /** @type {any} */ (h('dm-select', { label: `${t('review.kind.' + f.kind)}: ${f.column}` }));
          sel.options = [{ value: 'keep', label: t('review.choice.keep') }, { value: 'hash', label: t('review.choice.hash') }, { value: 'drop', label: t('review.choice.drop') }];
          sel.value = choices.get(key);
          sel.addEventListener('change', () => choices.set(key, sel.value));
          rows.push(sel);
        }
      }
      const body = h('div', { class: 'dm-stack' }, h('p', { class: 'dm-help', text: t('review.help') }), h('div', { class: 'dm-stack-sm' }, rows), h('p', { class: 'dm-help dm-small', text: t('review.note') }));
      const ok = await ctx.ui.dialog.open({ title: t('review.title'), body, size: 'lg', actions: [{ label: t('common.cancel'), value: false }, { label: t('review.continue'), variant: 'primary', value: true, primary: true }] });
      if (ok !== true) return null;
      const transform = {};
      for (const [key, choice] of choices) {
        if (choice === 'keep') continue;
        const [id, column] = key.split(SEP);
        const tr = transform[id] || (transform[id] = { drop: [], hash: [] });
        tr[choice].push(column);
      }
      return { transform, findings: found };
    }

    /** A short line for the log: how many columns were pseudonymised and dropped. */
    function summary(transform) {
      let hash = 0; let drop = 0;
      for (const tr of Object.values(transform || {})) { hash += (tr.hash || []).length; drop += (tr.drop || []).length; }
      return hash || drop ? t('review.applied', { hash, drop }) : '';
    }

    return { findings, scan, review, summary, PHONE_NAME };
  });
})();
