// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Readable change logs from a dataset's history (the `_log` table): one line per step, used by the history in
 * Hantera, by the change log in shared bundles (manifest `changes` and CHANGELOG.md) and by the summary shown when
 * a bundle is opened. Sharing and receiving a bundle are themselves logged, and the change log of the next bundle
 * starts after the latest of them.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('data/changelog', ['data/datasets', 'ui/i18n'], (datasets, i18n) => {
    const MARKERS = ['shared', 'received'];
    const MAX_ENTRIES = 200;
    const fmt = (v) => (typeof v === 'number' ? i18n.formatNumber(v) : String(v === undefined || v === null ? '' : v));

    /**
     * One history entry as text in the UI language.
     * @param {{ts: string, action: string, details: any}} entry
     */
    function describe(entry) {
      const d = entry.details && typeof entry.details === 'object' ? entry.details : {};
      switch (entry.action) {
        case 'op': case 'undo': case 'restore': return d.description || D.t('log.action.' + entry.action);
        case 'import': return D.t('log.import', { rows: fmt(d.rows) });
        case 'refresh': return d.steps ? D.t('log.refresh.steps', { rows: fmt(d.rows), steps: d.steps }) : D.t('log.refresh', { rows: fmt(d.rows) });
        case 'replace': return D.t('log.replace', { rows: fmt(d.rows) });
        case 'append': return D.t('log.append', { rows: fmt(d.rows) });
        case 'snapshot': return D.t('log.snapshot', { label: d.label || '' });
        case 'meta': return D.t('log.meta', { fields: Object.keys(d).join(', ') });
        case 'validate': return d.summary ? D.t('log.validate', { passed: d.summary.passed, rules: d.summary.rules }) : D.t('log.action.validate');
        case 'comment': return D.t('log.comment', { author: d.author || D.t('comments.anonymous'), text: d.text || '' });
        case 'shared': return D.t('log.shared', { name: d.name || '' });
        case 'received': return D.t('log.received', { name: d.name || '', author: d.author || D.t('comments.anonymous') });
        default: return typeof entry.details === 'string' ? entry.details : (d.description || entry.action);
      }
    }

    /** Label of an entry's kind (Import, Åtgärd, Kommentar …), or the raw action for unknown kinds. */
    function actionLabel(action) {
      const key = 'log.action.' + action;
      return i18n.has(key) ? D.t(key) : action;
    }

    /**
     * The entries after the latest share or receipt (all of them when the dataset was never shared), at most 200.
     * @param {Array<{ts: string, action: string, details: any}>} entries
     */
    function sinceLastShare(entries) {
      let start = 0;
      entries.forEach((e, i) => { if (MARKERS.includes(e.action)) start = i + 1; });
      return entries.slice(start).slice(-MAX_ENTRIES);
    }

    /**
     * Change log of datasets for a bundle: per dataset the readable steps since it was last shared or received.
     * @param {string[]} ids
     * @returns {Promise<Array<{id: string, name: string, entries: Array<{ts: string, action: string, text: string}>}>>}
     */
    async function forDatasets(ids) {
      const out = [];
      for (const id of ids) {
        const meta = await datasets.get(id);
        if (!meta) continue;
        const entries = sinceLastShare(await datasets.log(id)).map((e) => ({ ts: e.ts, action: e.action, text: describe(e) }));
        out.push({ id, name: meta.name, entries });
      }
      return out;
    }

    /**
     * CHANGELOG.md for a bundle, for whoever opens the ZIP outside the app.
     * @param {{name: string, author?: string, message?: string, created: string, changes: any[], comments?: Array<{dataset: string, author: string, column: string|null, text: string}>}} info
     */
    function markdown(info) {
      const lines = [`# ${info.name}`, '', `${info.author || D.t('comments.anonymous')}, ${i18n.formatDateTime(info.created)}`, ''];
      if (info.message) lines.push(info.message, '');
      for (const ds of info.changes) {
        lines.push(`## ${ds.name}`, '');
        if (!ds.entries.length) lines.push(D.t('bundle.changes.none'));
        for (const e of ds.entries) lines.push(`- ${i18n.formatDateTime(e.ts)}: ${e.text}`);
        lines.push('');
      }
      if (info.comments && info.comments.length) {
        lines.push(`## ${D.t('comments.title')}`, '');
        for (const c of info.comments) lines.push(`- ${c.dataset}${c.column ? ` (${c.column})` : ''}, ${c.author || D.t('comments.anonymous')}: ${c.text}`);
        lines.push('');
      }
      return lines.join('\n');
    }

    return { describe, actionLabel, sinceLastShare, forDatasets, markdown, MARKERS };
  });
})();
