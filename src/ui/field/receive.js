// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * What the computer does with a package from the field: show what it holds, and add the new rows only when the user says
 * so. It arrives through Enheter, Ta emot or a file dropped in Inhämta; all three end here (ui/share/bundle.receiveFile).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/field/receive', ['ui/base', 'data/field-form', 'data/field-collect'], (base, fieldForm, collect) => {
    const { h, t, i18n } = base;
    const PREVIEW_ROWS = 20;

    /**
     * @param {any} ctx the mode context @param {{kind: string, manifest: any, entries: Record<string, Uint8Array>}} pack
     * @returns {Promise<any|null>} what was added, or null
     */
    async function open(ctx, pack) {
      const { ui, shell, store } = ctx;
      const m = pack.manifest;
      if (pack.kind === fieldForm.FORM_KIND) {
        await ui.dialog.open({ title: t('field.receive.form'), help: 'insamling#formuläret', body: h('p', { text: t('field.receive.form.text', { name: m.name || '' }) }), actions: [{ label: t('common.close'), value: true, primary: true }] });
        return null;
      }
      const result = await collect.plan(pack);
      const device = m.device || t('p2p.device.phone');
      if (!result.rows.length) {
        await ui.dialog.open({ title: t('field.receive.title', { device }), help: 'insamling#på-datorn', body: h('p', { text: t('field.receive.nothing', { n: i18n.formatNumber(result.duplicates) }) }), actions: [{ label: t('common.close'), value: true, primary: true }] });
        return null;
      }
      const kv = /** @type {any} */ (h('dm-kv'));
      kv.items = [
        { label: t('field.receive.rows'), value: i18n.formatNumber(result.rows.length) },
        { label: t('field.receive.positions'), value: i18n.formatNumber(result.positions) },
        { label: t('field.receive.photos'), value: i18n.formatNumber(result.photos.length) },
      ].concat(result.duplicates ? [{ label: t('field.receive.duplicates'), value: i18n.formatNumber(result.duplicates) }] : [])
        .concat(result.flagged ? [{ label: t('field.receive.flagged'), value: i18n.formatNumber(result.flagged) }] : []);
      const table = fieldForm.toTable(m, result.rows.slice(0, PREVIEW_ROWS));
      const preview = /** @type {any} */ (h('dm-table', { class: 'dm-field-preview' }));
      const name = /** @type {any} */ (h('dm-input', { label: t('field.receive.name') }));
      name.value = m.datasetName || m.name || '';
      const body = h('div', { class: 'dm-stack' },
        h('p', { text: result.target ? t('field.receive.into', { name: result.target.name }) : t('field.receive.new') }),
        result.target ? null : name,
        kv,
        result.missing.length ? h('p', { class: 'dm-help', text: t('field.receive.missing', { columns: result.missing.join(', ') }) }) : null,
        result.target ? h('p', { class: 'dm-help', text: t('field.receive.version') }) : null,
        preview);
      requestAnimationFrame(() => {
        if (!preview.isConnected) return;
        preview.setData({ columns: table.columns.map((c) => ({ key: c, label: c })), rowCount: table.rows.length, rowProvider: async (start, count) => table.rows.slice(start, start + count) });
      });
      const ok = await ui.dialog.open({
        title: t('field.receive.title', { device }), help: 'insamling#på-datorn', body, size: 'lg',
        actions: [{ label: t('common.cancel'), value: false }, { label: t('field.receive.add', { n: i18n.formatNumber(result.rows.length) }), variant: 'primary', value: true, primary: true }],
      });
      if (ok !== true) return null;
      const res = await collect.apply(result, { name: name.value.trim() });
      const text = t('field.receive.done', { n: i18n.formatNumber(res.rows), photos: i18n.formatNumber(res.photos) });
      shell.log(text, 'ok');
      ui.toast.show(text, { kind: 'ok' });
      if (res.photosSkipped.length) shell.log(t('field.receive.photos.skipped', { names: res.photosSkipped.join(', ') }), 'warn');
      if (res.broken) shell.log(t('field.receive.broken', { n: i18n.formatNumber(res.broken) }), 'warn');
      store.set({ selectedId: res.datasetId });
      return res;
    }

    return { open };
  });
})();
