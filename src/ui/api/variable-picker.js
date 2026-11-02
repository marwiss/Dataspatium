// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * <dm-variable-picker>: choose values per variable (PxWeb tables, Socialstyrelsen subjects, multi
 * parameters). `variables = [{code, text, values: [{code, text}], elimination, time, metric}]`,
 * `selection` = {code: {filter: 'all'|'none'|'top'|'item', values?, n?}}. Emits `dm-change`.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/variable-picker', ['ui/base', 'ui/basic', 'ui/icons'], (base, basic, icons) => {
    const { h, DmElement, define, t, i18n, replace } = base;
    const PAGE = 300;

    /** Sensible defaults: metrics all, time latest, mandatory variables all, optional ones left out. */
    function defaultSelection(variables) {
      const sel = {};
      for (const v of variables) {
        if (v.metric) sel[v.code] = { filter: 'all' };
        else if (v.time) sel[v.code] = { filter: 'top', n: 1 };
        else if (v.elimination) sel[v.code] = { filter: 'none' };
        else sel[v.code] = { filter: 'all' };
      }
      return sel;
    }

    class DmVariablePicker extends DmElement {
      constructor() { super(); this._vars = []; this._sel = {}; this._filters = {}; this._limits = {}; this._cards = new Map(); }
      connectedCallback() { this.render(); }
      set variables(list) { this._vars = list || []; this._sel = defaultSelection(this._vars); this._filters = {}; this._limits = {}; this.render(); }
      get variables() { return this._vars; }
      get selection() { return JSON.parse(JSON.stringify(this._sel)); }
      set selection(sel) { this._sel = Object.assign(defaultSelection(this._vars), sel || {}); this.render(); }

      /** Codes currently chosen for a variable (explicit list). */
      chosen(v) {
        const sel = this._sel[v.code] || { filter: 'none' };
        if (sel.filter === 'all') return new Set(v.values.map((x) => x.code));
        if (sel.filter === 'item') return new Set(sel.values || []);
        if (sel.filter === 'top') return new Set(v.values.slice(-Math.max(1, sel.n || 1)).map((x) => x.code));
        return new Set();
      }
      count(v) {
        const sel = this._sel[v.code] || { filter: 'none' };
        if (sel.filter === 'all') return v.values.length;
        if (sel.filter === 'item') return (sel.values || []).length;
        if (sel.filter === 'top') return Math.min(sel.n || 1, v.values.length);
        return 0;
      }
      setSelection(v, sel) { this._sel[v.code] = sel; this.renderCard(v); this.emit('dm-change', { selection: this.selection }); }
      toggle(v, code, on) {
        const set = this.chosen(v);
        if (on) set.add(code); else set.delete(code);
        const values = v.values.map((x) => x.code).filter((c) => set.has(c));
        this.setSelection(v, values.length === v.values.length ? { filter: 'all' } : (values.length ? { filter: 'item', values } : { filter: 'none' }));
      }

      render() {
        if (!this.isConnected) return;
        this._cards.clear();
        replace(this, this._vars.map((v) => { const card = h('div', { class: 'dm-picker-card dm-card' }); this._cards.set(v.code, card); this.fillCard(v, card); return card; }));
      }
      renderCard(v) { const card = this._cards.get(v.code); if (card) this.fillCard(v, card); }

      fillCard(v, card) {
        const sel = this._sel[v.code] || { filter: 'none' };
        const chosen = this.chosen(v);
        const filter = (this._filters[v.code] || '').toLowerCase();
        const limit = this._limits[v.code] || PAGE;
        const matching = filter ? v.values.filter((x) => x.text.toLowerCase().includes(filter) || x.code.toLowerCase().includes(filter)) : v.values;
        const visible = matching.slice(0, limit);
        const search = /** @type {any} */ (h('dm-input', { type: 'search', placeholder: t('api.picker.search'), 'aria-label': t('api.picker.search'), inline: true }));
        search.value = this._filters[v.code] || '';
        let timer = 0;
        search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { this._filters[v.code] = search.value; this._limits[v.code] = PAGE; this.fillCard(v, card); setTimeout(() => search.focus(), 0); }, 200); });
        const topInput = /** @type {any} */ (h('dm-input', { type: 'number', min: '1', max: String(v.values.length), 'aria-label': t('api.picker.latest'), inline: true, style: { width: '80px' } }));
        topInput.value = sel.filter === 'top' ? String(sel.n || 1) : '1';
        topInput.addEventListener('change', () => { const n = Math.max(1, Math.min(v.values.length, Number(topInput.value) || 1)); this.setSelection(v, { filter: 'top', n }); });
        const state = v.elimination && sel.filter === 'none' ? t('api.picker.eliminated') : t('api.picker.of', { n: i18n.formatNumber(this.count(v)), total: i18n.formatNumber(v.values.length) });
        replace(card,
          h('div', { class: 'dm-picker-head' },
            h('div', null, h('strong', { text: v.text }), ' ', h('span', { class: 'dm-help', text: v.code !== v.text ? v.code : '' })),
            h('span', { class: 'dm-row' }, h('dm-badge', { kind: sel.filter === 'none' && !v.elimination ? 'warn' : null, text: state }), h('span', { class: 'dm-help', text: v.elimination ? t('api.picker.optional') : t('api.picker.required') }))),
          h('div', { class: 'dm-row-wrap' },
            basic.button({ label: t('api.picker.all'), size: 'sm', onClick: () => this.setSelection(v, { filter: 'all' }) }),
            basic.button({ label: t('api.picker.none'), size: 'sm', onClick: () => this.setSelection(v, { filter: 'none' }) }),
            v.time ? h('span', { class: 'dm-row' }, basic.button({ label: t('api.picker.latest'), size: 'sm', variant: sel.filter === 'top' ? 'primary' : 'default', onClick: () => this.setSelection(v, { filter: 'top', n: Math.max(1, Number(topInput.value) || 1) }) }), topInput) : null,
            v.values.length > 12 ? search : null),
          h('div', { class: 'dm-check-list', role: 'group', 'aria-label': v.text },
            visible.map((x) => h('label', { class: 'dm-check' },
              h('input', { type: 'checkbox', checked: chosen.has(x.code) ? true : null, onchange: (e) => this.toggle(v, x.code, /** @type {HTMLInputElement} */ (e.target).checked) }),
              h('span', { text: x.text }), x.text !== x.code ? h('span', { class: 'dm-faint dm-xs', text: x.code }) : null)),
            matching.length > visible.length ? basic.button({ label: t('api.picker.more', { n: i18n.formatNumber(matching.length - visible.length) }), size: 'sm', variant: 'ghost', onClick: () => { this._limits[v.code] = limit + PAGE * 2; this.fillCard(v, card); } }) : null,
            !matching.length ? h('p', { class: 'dm-help', text: t('table.no.rows') }) : null));
      }
    }
    define('dm-variable-picker', DmVariablePicker);
    return { DmVariablePicker, defaultSelection, icons };
  });
})();
