// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The tool Materialinventering among the model tools in Analysera (ui/analysis/model-panel): a basis for the waste management
 * plan (avfallshanteringsplan) of PBL 10 kap. 8 a §, in the provision's order. Point 1, the building products that can be
 * reused: the elements with a type and their product identities. Point 2, the waste: the sums per waste fraction of
 * avfallsförordningen 3 kap. 10 § and per layer of the building and fraction (for high-quality recycling), and the hazardous
 * substances the model names (for their safe handling); and every element and material with its quantity, fraction and rule.
 * Nothing is fetched: the model's file is read in the browser. The logic lives in analysis/inventory; every view can be saved as a
 * dataset through the model panel, and a button opens IDS-kontroll with the app's IDS for the inventory.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/analysis/inventory-panel', ['ui/base', 'ui/basic', 'analysis/inventory', 'analysis/climate'], (base, basic, inventory, climate) => {
    const { h, t, i18n, replace } = base;
    const VIEWS = ['reuse', 'fractions', 'layers', 'hazards', 'elements'];
    /** The app's IDS for the inventory (presets/ids). */
    const IDS = 'presets/ids/SE-Dataspatium_Avfallshantering.ids';

    /**
     * @param {any} ctx shell context
     * @param {{refresh?: () => void, openIds?: (name: string) => void}} [options] refresh draws the fields and the result again;
     *   openIds opens IDS-kontroll with an IDS file of the app
     */
    function create(ctx, options = {}) {
      const { ui, shell } = ctx;
      const s = { view: 'reuse' };
      /** The model's facts, per dataset and version: {key, promise}. @type {{key: string, promise: Promise<any>}|null} */ let gathered = null;
      const refresh = () => { if (options.refresh) options.refresh(); };
      const keyOf = (ds) => ds.id + ':' + (ds.updatedAt || '');
      const n = (v) => i18n.formatNumber(v);

      /** The model's facts, read once per version. */
      function dataOf(ds) {
        const key = keyOf(ds);
        if (!gathered || gathered.key !== key) {
          const promise = inventory.gather(ds.id);
          gathered = { key, promise };
          promise.catch(() => { if (gathered && gathered.promise === promise) gathered = null; });
        }
        return gathered.promise;
      }

      /** What to show, and the app's IDS for the inventory. */
      async function fields() {
        return [h('div', { class: 'dm-row-wrap' },
          basic.select(t('inventory.view'), VIEWS.map((v) => ({ value: v, label: t('inventory.view.' + v) })), s.view, (v) => { s.view = v; refresh(); }, { 'data-inventory-view': '' }),
          options.openIds ? ui.button({ label: t('inventory.ids'), icon: 'circle-check', size: 'sm', variant: 'ghost', title: t('inventory.ids.hint'), 'data-inventory-ids': '', onClick: () => options.openIds(IDS) }) : null)];
      }

      /** What the view rests on: the basis, what the view holds, and what is missing or left to the person. */
      function notes(data, built, extra) {
        const out = [t('inventory.note.basis'), extra];
        if (!data.hasFile) out.push(t('climate.note.nofile'));
        if (data.containers) out.push(t('climate.note.containers', { n: n(data.containers) }));
        const rows = built.rows;
        const none = rows.filter((r) => r.volume === null && r.area === null && r.mass === null).length;
        if (none) out.push(t('inventory.note.noquantity', { n: n(none) }));
        const noMass = rows.filter((r) => r.mass === null && typeof r.volume === 'number').length;
        if (noMass) out.push(t('inventory.note.nodensity', { n: n(noMass) }));
        const open = rows.filter((r) => r.fraction === 'ovrigt').length;
        if (open) out.push(t('inventory.note.open', { n: n(open) }));
        const hazards = new Set(rows.filter((r) => r.hazards.length).map((r) => r.id)).size + Array.from(data.hazards.keys()).filter((id) => !rows.some((r) => r.id === id)).length;
        out.push(hazards ? t('inventory.note.hazards', { n: n(hazards) }) : t('inventory.note.nohazards'));
        return out.filter(Boolean).join(' ');
      }

      /**
       * Draw the chosen view into the result area. @param {any} ds @param {HTMLElement} resultEl
       * @param {{isCurrent: () => boolean, showTable: (out: any) => void}} hooks the model panel's table
       */
      async function run(ds, resultEl, hooks) {
        replace(resultEl, h('dm-progress', { indeterminate: true, label: t('climate.loading') }));
        let data; let settled;
        try { [data, settled] = await Promise.all([dataOf(ds), climate.settled()]); } catch (err) {
          if (!hooks.isCurrent()) return;
          const msg = String((err && err.message) || err);
          replace(resultEl, h('p', { class: 'dm-error dm-small', text: msg }));
          shell.log(msg, 'error');
          return;
        }
        if (!hooks.isCurrent()) return;
        const built = inventory.build(data, { settled });
        let out;
        if (s.view === 'reuse') {
          out = inventory.reuseTable(built.elements, built.rows, data.products);
          const withData = out.rows.filter((r) => r[9] || r[10] || r[11] || r[13] || r[14]).length;
          out.note = notes(data, built, t('inventory.note.reuse', { n: n(out.rows.length), data: n(withData) }));
        } else if (s.view === 'fractions') out = Object.assign(inventory.fractionTable(built.rows), { note: notes(data, built, t('inventory.note.fractions')) });
        else if (s.view === 'layers') out = Object.assign(inventory.layerTable(built.rows), { note: notes(data, built, t('inventory.note.layers')) });
        else if (s.view === 'hazards') {
          out = inventory.hazardTable(built.elements, built.rows, data.hazards);
          out.note = [t('inventory.note.basis'), t(out.rows.length ? 'inventory.note.hazardlist' : 'inventory.note.nohazards')].join(' ');
        } else out = Object.assign(inventory.elementTable(built.rows), { note: notes(data, built, t('inventory.note.elements', { n: n(built.rows.length) })) });
        out.name = `${ds.name}: ${t('inventory.view.' + s.view)}`;
        hooks.showTable(out);
        const head = resultEl.firstElementChild;
        if (head) head.setAttribute('data-inventory-result', s.view);
      }

      /** The provision, the fractions and the limits, for the inspector. */
      function inspector() {
        return ['law', 'fractions', 'limits', 'ids'].map((k) => h('p', { class: 'dm-help', text: t('inventory.inspector.' + k) }));
      }

      return { fields, run, inspector, state: s };
    }
    return { create, VIEWS, IDS };
  });
})();
