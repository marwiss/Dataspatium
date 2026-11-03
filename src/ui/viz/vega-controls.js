// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Controls for the Vega-Lite builder: chart type, channels (column, interpretation, aggregate),
 * stacking, labels, titles, formats, filters and, under "Fler alternativ", row limit, colour scheme
 * and a raw specification editor. Calls `onChange(state)` after every change.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/viz/vega-controls', ['ui/base', 'ui/basic', 'ui/icons', 'viz/vega-builder', 'viz/data', 'viz/locale'], (base, basic, icons, builder, vizData, locale) => {
    const { h, t, replace } = base;
    const FIELD_TYPES = ['quantitative', 'nominal', 'ordinal', 'temporal'];

    /**
     * @param {{columns: any[], state: any, customSpec: string|null, onChange: (state: any, customSpec: string|null) => void}} options
     */
    function create(options) {
      let { state, customSpec } = options;
      const columns = options.columns;
      const el = h('div', { class: 'dm-stack dm-viz-controls' });
      let timer = 0;
      const emit = (immediate) => { clearTimeout(timer); timer = setTimeout(() => options.onChange(state, customSpec), immediate ? 0 : 250); };

      function columnSelect(label, value, onPick, { optional = true, kinds = null } = {}) {
        const sel = /** @type {any} */ (h('dm-select', { label }));
        const list = kinds ? columns.filter((c) => kinds.includes(c.type)) : columns;
        sel.options = (optional ? [{ value: '', label: t('viz.channel.none') }] : []).concat(list.map((c) => ({ value: c.name, label: `${c.name} (${t('type.' + c.type)})` })));
        sel.value = value || '';
        sel.addEventListener('change', () => onPick(sel.value ? columns.find((c) => c.name === sel.value) : null));
        return sel;
      }
      function smallSelect(label, options2, value, onPick) {
        const sel = /** @type {any} */ (h('dm-select', { label }));
        sel.options = options2; sel.value = value;
        sel.addEventListener('change', () => onPick(sel.value));
        return sel;
      }

      function channelCard(key, label, { optional, allowAggregate = true }) {
        const type = builder.typeOf(state.type);
        if (!type.channels.includes(key)) return null;
        const ch = state[key];
        const isCount = key === 'y' && type.y === 'count';
        const nodes = [];
        if (isCount) { nodes.push(h('div', { class: 'dm-help', text: t('viz.agg.count') })); return h('div', { class: 'dm-card dm-stack-sm dm-viz-channel' }, h('strong', { text: label }), nodes); }
        nodes.push(columnSelect(label, ch && ch.field, (col) => { state[key] = col ? builder.channel(col, { aggregate: ch && ch.aggregate && col.type !== 'text' ? ch.aggregate : (key === 'y' && (col.type === 'integer' || col.type === 'number') && type.aggregate !== 'none' ? type.aggregate : 'none') }) : null; render(); emit(true); }, { optional, kinds: type.geo && key === 'x' ? ['text'] : null }));
        // Maps: the geometry and label channels need no interpretation, aggregate or sort options.
        if (ch && ch.field && !(type.geo && key !== 'color')) {
          const row = [];
          row.push(smallSelect(t('viz.channel.type'), FIELD_TYPES.map((ft) => ({ value: ft, label: t('viz.type.' + ft) })), ch.type, (v) => { ch.type = v; if (v !== 'quantitative') ch.aggregate = 'none'; render(); emit(); }));
          if (allowAggregate && ch.type === 'quantitative') row.push(smallSelect(t('viz.aggregate'), builder.AGGREGATES.map((a) => ({ value: a, label: t('viz.agg.' + a) })), ch.aggregate || 'none', (v) => { ch.aggregate = v; emit(); }));
          if (ch.type === 'temporal') row.push(smallSelect(t('viz.timeunit'), builder.TIME_UNITS.map((u) => ({ value: u, label: u || t('viz.sort.auto') })), ch.timeUnit || '', (v) => { ch.timeUnit = v; emit(); }));
          if ((key === 'x' || key === 'color') && ch.type !== 'quantitative') row.push(smallSelect(t('viz.sort'), [{ value: '', label: t('viz.sort.auto') }, { value: 'ascending', label: t('viz.sort.asc') }, { value: 'descending', label: t('viz.sort.desc') }, { value: '-y', label: t('viz.sort.byvalue') }], ch.sort || '', (v) => { ch.sort = v; emit(); }));
          if (key === 'x' && ch.type === 'quantitative') { const sw = /** @type {any} */ (h('dm-switch', { label: t('viz.bin') })); sw.checked = !!ch.bin; sw.addEventListener('change', () => { ch.bin = sw.checked; emit(); }); row.push(sw); }
          const title = /** @type {any} */ (h('dm-input', { label: t('viz.channel.title'), placeholder: ch.field, inline: true }));
          title.value = ch.title || '';
          title.addEventListener('change', () => { ch.title = title.value.trim(); emit(); });
          row.push(title);
          nodes.push(h('div', { class: 'dm-form-grid dm-viz-channel-opts' }, row));
        }
        return h('div', { class: 'dm-card dm-stack-sm dm-viz-channel' }, nodes);
      }

      function filtersEditor() {
        const list = h('div', { class: 'dm-stack-sm' });
        const draw = () => replace(list, (state.filters || []).map((f, i) => {
          const col = columnSelect('', f.field, (c) => { f.field = c ? c.name : ''; emit(); }, { optional: false });
          col.setAttribute('aria-label', t('param.column'));
          const op = smallSelect('', vizData.OPERATORS.map((o) => ({ value: o.id, label: o.label })), f.op || '=', (v) => { f.op = v; emit(); });
          op.setAttribute('aria-label', 'Operator');
          const val = /** @type {any} */ (h('dm-input', { placeholder: t('viz.filters.value'), 'aria-label': t('viz.filters.value'), inline: true }));
          val.value = f.value === undefined || f.value === null ? '' : String(f.value);
          val.addEventListener('input', () => { f.value = val.value; emit(); });
          return h('div', { class: 'dm-row dm-viz-filter' }, col, op, val, basic.button({ label: t('common.delete'), icon: 'x', 'icon-only': true, variant: 'ghost', size: 'sm', onClick: () => { state.filters.splice(i, 1); draw(); emit(true); } }));
        }));
        draw();
        return h('div', { class: 'dm-stack-sm' }, h('div', { class: 'dm-row' }, h('strong', { text: t('viz.filters') }), basic.button({ label: t('viz.filters.add'), icon: 'plus', size: 'sm', onClick: () => { state.filters = state.filters || []; state.filters.push({ field: columns[0] ? columns[0].name : '', op: '=', value: '' }); draw(); } })), list);
      }

      function render() {
        const type = builder.typeOf(state.type);
        const typeTiles = h('div', { class: 'dm-viz-types', role: 'radiogroup', 'aria-label': t('viz.type') }, builder.CHART_TYPES.map((ct) => h('button', { type: 'button', class: 'dm-viz-type', role: 'radio', 'aria-checked': ct.id === state.type ? 'true' : 'false', title: ct.label, onclick: () => { state = builder.switchType(state, ct.id, columns); render(); emit(true); } }, icons.icon(ct.icon, 18), h('span', { text: ct.label }))));
        const stack = smallSelect(t('viz.stack'), [{ value: 'zero', label: t('viz.stack.zero') }, { value: 'normalize', label: t('viz.stack.normalize') }, { value: 'none', label: t('viz.stack.none') }], state.stack || 'zero', (v) => { state.stack = v; emit(); });
        const labels = /** @type {any} */ (h('dm-switch', { label: t('viz.labels') })); labels.checked = !!state.labels; labels.addEventListener('change', () => { state.labels = labels.checked; emit(); });
        const points = /** @type {any} */ (h('dm-switch', { label: t('viz.points') })); points.checked = !!state.points; points.addEventListener('change', () => { state.points = points.checked; emit(); });
        const title = /** @type {any} */ (h('dm-input', { label: t('viz.title') })); title.value = state.title || ''; title.addEventListener('input', () => { state.title = title.value; emit(); });
        const subtitle = /** @type {any} */ (h('dm-input', { label: t('viz.subtitle') })); subtitle.value = state.subtitle || ''; subtitle.addEventListener('input', () => { state.subtitle = subtitle.value; emit(); });
        const yFormat = smallSelect(t('viz.yformat'), locale.NUMBER_FORMATS.map((f) => ({ value: f.pattern, label: f.label })), state.yFormat || '', (v) => { state.yFormat = v; emit(); });
        const height = /** @type {any} */ (h('dm-input', { type: 'number', label: t('viz.height'), min: '120', max: '2000' })); height.value = String(state.height || 360); height.addEventListener('change', () => { state.height = Number(height.value) || 360; emit(); });
        const legend = smallSelect(t('viz.legend'), ['right', 'bottom', 'top', 'none'].map((v) => ({ value: v, label: t('viz.legend.' + v) })), state.legend || 'right', (v) => { state.legend = v; emit(); });
        const facetCols = /** @type {any} */ (h('dm-input', { type: 'number', label: t('viz.facet.columns'), min: '1', max: '8' })); facetCols.value = String(state.facetColumns || 3); facetCols.addEventListener('change', () => { state.facetColumns = Number(facetCols.value) || 3; emit(); });
        const maxRows = /** @type {any} */ (h('dm-input', { type: 'number', label: t('viz.maxrows'), min: '100', max: '1000000' })); maxRows.value = String(state.maxRows || 50000); maxRows.addEventListener('change', () => { state.maxRows = Number(maxRows.value) || 50000; emit(); });
        const scheme = smallSelect(t('viz.colorscheme'), ['auto', 'sequential', 'diverging'].map((v) => ({ value: v, label: t('viz.scheme.' + v) })), state.colorScheme || 'auto', (v) => { state.colorScheme = v; emit(); });
        const customSwitch = /** @type {any} */ (h('dm-switch', { label: t('viz.custom') })); customSwitch.checked = customSpec !== null;
        const customEditor = /** @type {any} */ (h('dm-code', { language: 'json' }));
        customEditor.value = customSpec || '';
        customEditor.addEventListener('dm-change', () => { if (customSpec !== null) { customSpec = customEditor.value; emit(); } });
        customSwitch.addEventListener('change', () => { if (customSwitch.checked) { customSpec = customEditor.value || JSON.stringify(builder.toSpec(state, columns, { name: 'table' }), null, 2); customEditor.value = customSpec; } else customSpec = null; render(); emit(true); });
        replace(el,
          h('div', { class: 'dm-stack-sm' }, h('span', { class: 'dm-label', text: t('viz.type') }), typeTiles),
          customSpec === null ? [
            channelCard('x', type.geo ? t('viz.channel.geometry') : t('viz.channel.x'), { optional: false, allowAggregate: !type.geo }),
            channelCard('y', type.geo ? t('viz.channel.label') : t('viz.channel.y'), { optional: !!type.geo, allowAggregate: !type.geo }),
            channelCard('color', type.geo ? t('viz.channel.value') : t('viz.channel.color'), { optional: !type.geo }),
            channelCard('size', t('viz.channel.size'), { optional: true }),
            channelCard('facet', t('viz.channel.facet'), { optional: true, allowAggregate: false }),
            h('div', { class: 'dm-form-grid' }, title, subtitle, yFormat, height, legend, state.facet ? facetCols : null, (type.mark === 'bar' || type.mark === 'area') && state.color ? stack : null),
            h('div', { class: 'dm-row-wrap' }, type.mark === 'bar' ? labels : null, type.mark === 'line' ? points : null),
            filtersEditor(),
          ] : h('p', { class: 'dm-help', text: t('viz.custom.help') }),
          h('details', { class: 'dm-more', open: customSpec !== null ? true : null }, h('summary', { text: t('common.more') }), h('div', { class: 'dm-stack-sm' }, h('div', { class: 'dm-form-grid' }, maxRows, scheme), customSwitch, customSpec !== null ? h('div', { class: 'dm-editor-wrap' }, customEditor) : null)));
      }

      render();
      return { el, get state() { return state; }, get customSpec() { return customSpec; }, render };
    }
    return { create };
  });
})();
