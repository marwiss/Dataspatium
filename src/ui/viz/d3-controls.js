// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Controls for D3 templates: template choice with description, parameters generated from the
 * template's schema (columns filtered by kind, texts, numbers, selects), titles and filters.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/viz/d3-controls', ['ui/base', 'ui/basic', 'ui/icons', 'viz/d3-templates', 'viz/data'], (base, basic, icons, d3t, vizData) => {
    const { h, t, replace } = base;

    /**
     * @param {{columns: any[], template: string, params: Record<string, any>, filters: any[], onChange: (template: string, params: any, filters: any[]) => void}} options
     */
    function create(options) {
      const columns = options.columns;
      let template = options.template || 'lollipop';
      let params = Object.assign({}, options.params || {});
      let filters = (options.filters || []).slice();
      const el = h('div', { class: 'dm-stack dm-viz-controls' });
      let timer = 0;
      const emit = (immediate) => { clearTimeout(timer); timer = setTimeout(() => options.onChange(template, params, filters), immediate ? 0 : 250); };

      function defaults(tpl) {
        const p = {};
        for (const param of tpl.params) {
          if (param.type === 'column') { const used = Object.values(p); const col = columns.find((c) => (!param.kinds || param.kinds.includes(c.type)) && !used.includes(c.name)) || columns.find((c) => !param.kinds || param.kinds.includes(c.type)); if (col) p[param.name] = col.name; }
          else if (param.default !== undefined) p[param.name] = param.default;
        }
        return p;
      }

      function field(param) {
        const label = param.label + (param.required ? ' *' : '');
        if (param.type === 'column') {
          const sel = /** @type {any} */ (h('dm-select', { label }));
          const list = columns.filter((c) => !param.kinds || param.kinds.includes(c.type));
          sel.options = (param.required ? [] : [{ value: '', label: t('viz.channel.none') }]).concat(list.map((c) => ({ value: c.name, label: `${c.name} (${t('type.' + c.type)})` })));
          sel.value = params[param.name] || '';
          sel.addEventListener('change', () => { params[param.name] = sel.value; emit(true); });
          return sel;
        }
        if (param.type === 'select') {
          const sel = /** @type {any} */ (h('dm-select', { label }));
          sel.options = param.options; sel.value = params[param.name] !== undefined ? String(params[param.name]) : String(param.default || '');
          sel.addEventListener('change', () => { params[param.name] = sel.value; emit(); });
          return sel;
        }
        const input = /** @type {any} */ (h('dm-input', { type: param.type === 'number' ? 'number' : 'text', label, help: param.help || '' }));
        input.value = params[param.name] !== undefined ? params[param.name] : (param.default !== undefined ? param.default : '');
        input.addEventListener('input', () => { params[param.name] = param.type === 'number' ? Number(input.value) : input.value; emit(); });
        return input;
      }

      function filtersEditor() {
        const list = h('div', { class: 'dm-stack-sm' });
        const draw = () => replace(list, filters.map((f, i) => {
          const col = /** @type {any} */ (h('dm-select', { 'aria-label': t('param.column') }));
          col.options = columns.map((c) => ({ value: c.name, label: c.name })); col.value = f.field || '';
          col.addEventListener('change', () => { f.field = col.value; emit(); });
          const op = /** @type {any} */ (h('dm-select', { 'aria-label': 'Operator' }));
          op.options = vizData.OPERATORS.map((o) => ({ value: o.id, label: o.label })); op.value = f.op || '=';
          op.addEventListener('change', () => { f.op = op.value; emit(); });
          const val = /** @type {any} */ (h('dm-input', { placeholder: t('viz.filters.value'), 'aria-label': t('viz.filters.value'), inline: true }));
          val.value = f.value === undefined ? '' : String(f.value);
          val.addEventListener('input', () => { f.value = val.value; emit(); });
          return h('div', { class: 'dm-row dm-viz-filter' }, col, op, val, basic.button({ label: t('common.delete'), icon: 'x', 'icon-only': true, variant: 'ghost', size: 'sm', onClick: () => { filters.splice(i, 1); draw(); emit(true); } }));
        }));
        draw();
        return h('div', { class: 'dm-stack-sm' }, h('div', { class: 'dm-row' }, h('strong', { text: t('viz.filters') }), basic.button({ label: t('viz.filters.add'), icon: 'plus', size: 'sm', onClick: () => { filters.push({ field: columns[0] ? columns[0].name : '', op: '=', value: '' }); draw(); } })), list);
      }

      function render() {
        const tpl = d3t.get(template) || d3t.templates[0];
        const tiles = h('div', { class: 'dm-viz-types', role: 'radiogroup' }, d3t.templates.map((x) => h('button', { type: 'button', class: 'dm-viz-type', role: 'radio', 'aria-checked': x.id === template ? 'true' : 'false', title: x.description, onclick: () => { template = x.id; params = Object.assign(defaults(x), { title: params.title, subtitle: params.subtitle }); render(); emit(true); } }, icons.icon(x.icon, 18), h('span', { text: x.name }))));
        if (!Object.keys(params).some((k) => tpl.params.some((p) => p.name === k))) params = Object.assign(defaults(tpl), params);
        const title = /** @type {any} */ (h('dm-input', { label: t('viz.title') })); title.value = params.title || ''; title.addEventListener('input', () => { params.title = title.value; emit(); });
        const subtitle = /** @type {any} */ (h('dm-input', { label: t('viz.subtitle') })); subtitle.value = params.subtitle || ''; subtitle.addEventListener('input', () => { params.subtitle = subtitle.value; emit(); });
        replace(el,
          h('div', { class: 'dm-stack-sm' }, h('span', { class: 'dm-label', text: t('viz.template') }), tiles, h('p', { class: 'dm-help', text: tpl.description })),
          h('div', { class: 'dm-form-grid' }, tpl.params.map(field)),
          h('div', { class: 'dm-form-grid' }, title, subtitle),
          filtersEditor());
      }
      render();
      return { el, get template() { return template; }, get params() { return params; }, get filters() { return filters; }, render };
    }
    return { create };
  });
})();
