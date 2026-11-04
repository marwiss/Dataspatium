// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Sharing bundles: the dialog that creates one (chosen datasets plus charts, dashboards, templates, notebooks
 * and scripts, with a message and the sender's name), the summary shown when a bundle or a GitHub folder comes
 * in, and the report of what a restore brought. Used by Dela, by Hantera's restore zone and by the GitHub card.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/share/bundle', ['ui/base'], (base) => {
    const { h, t, i18n } = base;

    /**
     * Selective sharing bundle: chosen datasets plus charts, dashboards, templates, notebooks and scripts.
     * @param {any} ctx the mode context (ui, services, store, shell)
     * @param {{datasetIds?: string[]}} [options] preselected datasets (default: all)
     */
    async function shareBundle(ctx, options = {}) {
      const { ui, services, store, shell } = ctx;
      const list = store.get().datasets;
      const comments = D.require('data/comments');
      const author = await comments.author();
      const name = /** @type {any} */ (h('dm-input', { label: t('bundle.name'), value: t('bundle.default.name') }));
      const authorIn = /** @type {any} */ (h('dm-input', { label: t('comments.author'), help: t('bundle.author.help') }));
      authorIn.value = author;
      const message = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '3', label: t('bundle.message'), help: t('bundle.message.help') }));
      const chosen = new Set(options.datasetIds || list.map((d) => d.id));
      const switches = list.map((d) => {
        const sw = /** @type {any} */ (h('dm-switch', { label: `${d.name} (${t('common.rows', { n: i18n.formatNumber(d.rowCount || 0) })})` }));
        sw.checked = chosen.has(d.id);
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
      const ok = await ui.dialog.open({ title: t('bundle.title'), help: 'dela#paket', body, size: 'lg', actions: [{ label: t('common.cancel'), value: false }, { label: t('bundle.create'), variant: 'primary', value: true, primary: true }] });
      if (ok !== true) return null;
      // Personal data in the chosen datasets: keep, pseudonymise or drop in the copy before it leaves the app.
      const reviewed = await D.require('ui/share/review').review(ctx, Array.from(chosen));
      if (!reviewed) return null;
      try {
        shell.setStatus('saving');
        const label = name.value.trim() || t('bundle.default.name');
        if (authorIn.value.trim() !== author) await comments.setAuthor(authorIn.value);
        const res = await services.workspace.bundle({ name: label, datasetIds: Array.from(chosen), include: inc, author: authorIn.value.trim(), message: message.value, transform: reviewed.transform });
        const note = D.require('ui/share/review').summary(reviewed.transform);
        if (note) shell.log(note, 'info');
        const file = services.files.safeName(label, 'dataspatium.zip');
        services.files.download(res.blob, file);
        shell.log(t('bundle.done', { name: file, n: res.counts.datasets }), 'ok');
        ui.toast.show(t('bundle.done', { name: file, n: res.counts.datasets }), { kind: 'ok' });
        shell.setStatus('saved');
        return res;
      } catch (err) {
        shell.log(String((err && err.message) || err), 'error');
        ui.toast.show(String((err && err.message) || err), { kind: 'error' });
        shell.setStatus('saved');
        return null;
      }
    }

    /** Log and announce what a restore brought in. */
    function reportRestore(ctx, res) {
      const { ui, shell } = ctx;
      const text = res.replaced && res.replaced.length ? t('datasets.restore.done.replaced', { n: res.imported.length, replaced: res.replaced.length }) : t('datasets.restore.done', { n: res.imported.length });
      shell.log(text, 'ok');
      ui.toast.show(text, { kind: 'ok' });
      if (res.existing) shell.log(t('datasets.restore.existing', { n: res.existing }), 'info');
      for (const s of res.skipped) shell.log(s, 'warn');
    }

    /**
     * What a bundle or a GitHub folder brings: sender, message, the changes per dataset and, for datasets that
     * already exist here, whether to take the incoming version. Resolves with {replaceIds} or null when cancelled.
     */
    async function incomingSummary(ctx, opened, title) {
      const { ui } = ctx;
      const manifest = opened.manifest || {};
      const existing = new Map((opened.existing || []).map((d) => [d.id, d]));
      const replaceSet = new Set();
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
          sw.addEventListener('change', () => { if (sw.checked) replaceSet.add(d.id); else replaceSet.delete(d.id); });
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
      return ok === true ? { replaceIds: Array.from(replaceSet) } : null;
    }

    /**
     * Open a bundle (or a backup) file: show the incoming summary for bundles, then restore.
     * @param {any} ctx @param {File|Blob} file
     */
    async function receiveFile(ctx, file) {
      const { services, shell, ui } = ctx;
      try {
        const opened = await services.workspace.inspect(file);
        // Packages from the field come in by the same doors as bundles.
        const field = D.require('data/field-form').fromEntries(opened.entries, opened.manifest);
        if (field) return await D.require('ui/field/receive').open(ctx, field);
        let replaceIds = [];
        if (opened.manifest && opened.manifest.kind === 'bundle') {
          const choice = await incomingSummary(ctx, opened, t('bundle.open.title', { name: opened.manifest.name || t('bundle.default.name') }));
          if (!choice) return null;
          replaceIds = choice.replaceIds;
        }
        const res = await services.workspace.restore(opened, { replaceIds });
        reportRestore(ctx, res);
        return res;
      } catch (err) {
        shell.log(String((err && err.message) || err), 'error');
        ui.toast.show(t('common.error') + ': ' + ((err && err.message) || err), { kind: 'error' });
        return null;
      }
    }

    return { shareBundle, incomingSummary, reportRestore, receiveFile };
  });
})();
