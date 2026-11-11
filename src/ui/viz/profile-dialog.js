// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The dialog of Höjdprofil längs en linje (decision F37 c): the geometry column, the column that names the lines, how many rows
 * from the top and the step in metres; then viz/profile fetches the heights and saves the dataset and the chart. Nothing is
 * asked of the terrain model before the person presses the button.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/viz/profile-dialog', ['ui/base', 'ui/basic', 'ui/overlays', 'viz/profile', 'data/datasets'], (base, basic, overlays, profile, datasets) => {
    const { h, t, i18n } = base;

    /**
     * Opens the dialog for a dataset and builds the profile. @param {any} ctx the shell context (its log is used)
     * @param {any} ds @returns {Promise<{dataset: any, chart: any}|null>} what was made, or null
     */
    async function open(ctx, ds) {
      const cols = await datasets.columns(ds.id);
      const geoCols = await profile.columns(ds.id);
      if (!geoCols.length) { overlays.toast.show(t('profile.err.column'), { kind: 'warn' }); return null; }
      const s = { column: geoCols[0].name, label: '', rows: 1, step: 10 };
      const labelOpts = [{ value: '', label: t('profile.label.none') }].concat(cols.filter((c) => c.type === 'text').map((c) => ({ value: c.name, label: c.name })));
      const numberField = (key, label, help) => {
        const el = /** @type {any} */ (h('dm-input', { label, type: 'number', help }));
        el.value = String(s[key]);
        el.addEventListener('input', () => { const n = Number(el.value); if (Number.isFinite(n) && n > 0) s[key] = n; });
        return el;
      };
      const body = h('div', { class: 'dm-stack-sm', 'data-profile-dialog': '' },
        h('p', { class: 'dm-help dm-small', text: t('profile.hint') }),
        basic.select(t('profile.column'), geoCols.map((c) => ({ value: c.name, label: c.name })), s.column, (v) => { s.column = v; }),
        basic.select(t('profile.label'), labelOpts, s.label, (v) => { s.label = v; }),
        numberField('rows', t('profile.rows'), t('profile.rows.help', { max: profile.MAX_LINES })),
        numberField('step', t('profile.step'), t('profile.step.help')));
      const ok = await overlays.dialog.open({
        title: t('profile.title'), help: 'visualisera#höjdprofil-längs-en-linje', body,
        actions: [{ label: t('common.cancel'), value: false }, { label: t('profile.run'), variant: 'primary', value: true, primary: true }],
      });
      if (ok !== true) return null;
      const log = (msg, kind) => { if (ctx && ctx.shell && ctx.shell.log) ctx.shell.log(msg, kind || 'ok'); };
      let made = null;
      try {
        log(t('profile.working'), 'info');
        made = await profile.build(ds, s);
      } catch (err) {
        const text = String((err && err.message) || err);
        log(text, 'error'); overlays.toast.show(text, { kind: 'error' });
        return null;
      }
      if (!made) { log(t('profile.none'), 'warn'); overlays.toast.show(t('profile.none'), { kind: 'warn' }); return null; }
      const done = t('profile.done', { points: i18n.formatNumber(made.found), lines: i18n.formatNumber(made.lines), name: made.dataset.name });
      log(done, 'ok'); overlays.toast.show(done, { kind: 'ok' });
      return made;
    }
    return { open };
  });
})();
