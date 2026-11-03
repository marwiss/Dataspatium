// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * D3 templates: hand-made chart types with a parameter schema, rendered as SVG with the app's style.
 * Templates: ranking (lollipop), slopegraph (two periods per category) and population pyramid.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('viz/d3-templates', ['viz/theme', 'viz/locale'], (theme, locale) => {
    async function ensureD3() {
      if (!globalThis.d3) await D.assets.loadVendorScript('vendor/d3/d3.min.js');
      const d3 = globalThis.d3;
      if (!d3.__dataspatiumLocale) { d3.__dataspatiumLocale = true; d3.formatDefaultLocale(locale.numberLocale); d3.timeFormatDefaultLocale(locale.timeLocale); }
      return d3;
    }
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));

    function frame(d3, container, width, height, style, title, subtitle) {
      container.replaceChildren();
      const svg = d3.select(container).append('svg').attr('xmlns', SVG_NS).attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).style('font-family', style.font).style('background', style.background);
      svg.append('rect').attr('width', width).attr('height', height).attr('fill', style.background);
      let top = 16;
      if (title) { svg.append('text').attr('x', 16).attr('y', top + 12).attr('font-size', style.title).attr('font-weight', 600).attr('fill', style.text).text(title); top += 24; }
      if (subtitle) { svg.append('text').attr('x', 16).attr('y', top + 10).attr('font-size', style.subtitle).attr('fill', style.muted).text(subtitle); top += 20; }
      return { svg, top: top + 8 };
    }
    function styleAxis(sel, style) {
      sel.selectAll('text').attr('fill', style.muted).attr('font-size', style.label).attr('font-family', style.font);
      sel.selectAll('line, path').attr('stroke', style.border);
      return sel;
    }

    const templates = [
      {
        id: 'lollipop', name: D.t('d3.lollipop.name'), icon: 'list-ordered',
        description: D.t('d3.lollipop.description'),
        params: [
          { name: 'category', label: D.t('d3.param.category'), type: 'column', kinds: ['text', 'boolean', 'integer'], required: true },
          { name: 'value', label: D.t('d3.param.value'), type: 'column', kinds: ['integer', 'number'], required: true },
          { name: 'aggregate', label: D.t('d3.param.aggregate'), type: 'select', options: [{ value: 'sum', label: D.t('d3.agg.sum') }, { value: 'mean', label: D.t('d3.agg.mean') }, { value: 'max', label: D.t('d3.agg.max') }, { value: 'min', label: D.t('d3.agg.min') }], default: 'sum' },
          { name: 'top', label: D.t('d3.param.top'), type: 'number', default: 20 },
          { name: 'order', label: D.t('d3.param.order'), type: 'select', options: [{ value: 'desc', label: D.t('d3.order.desc') }, { value: 'asc', label: D.t('d3.order.asc') }], default: 'desc' },
          { name: 'format', label: D.t('d3.param.format'), type: 'select', options: locale.NUMBER_FORMATS.map((f) => ({ value: f.pattern, label: f.label })), default: ',.0f' },
        ],
        render(d3, container, rows, p, style, size) {
          const groups = d3.rollups(rows.filter((r) => Number.isFinite(num(r[p.value]))), (v) => (p.aggregate === 'mean' ? d3.mean(v, (r) => num(r[p.value])) : p.aggregate === 'max' ? d3.max(v, (r) => num(r[p.value])) : p.aggregate === 'min' ? d3.min(v, (r) => num(r[p.value])) : d3.sum(v, (r) => num(r[p.value]))), (r) => String(r[p.category]));
          groups.sort((a, b) => (p.order === 'asc' ? a[1] - b[1] : b[1] - a[1]));
          const data = groups.slice(0, Math.max(1, Number(p.top) || 20));
          const rowH = 24; const margin = { left: 160, right: 70, bottom: 30 };
          const height = size.height || (data.length * rowH + 80);
          const { svg, top } = frame(d3, container, size.width, height, style, p.title, p.subtitle);
          const x = d3.scaleLinear().domain([Math.min(0, d3.min(data, (d) => d[1]) || 0), d3.max(data, (d) => d[1]) || 1]).nice().range([margin.left, size.width - margin.right]);
          const y = d3.scaleBand().domain(data.map((d) => d[0])).range([top, top + data.length * rowH]).padding(0.3);
          const fmt = d3.format(p.format || ',.0f');
          styleAxis(svg.append('g').attr('transform', `translate(0,${top + data.length * rowH})`).call(d3.axisBottom(x).ticks(Math.max(2, Math.floor((size.width - margin.left - margin.right) / 110))).tickFormat(fmt).tickSize(-(data.length * rowH))), style).selectAll('line').attr('stroke', style.grid);
          styleAxis(svg.append('g').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y).tickSize(0)), style).select('.domain').remove();
          svg.selectAll('text').attr('font-family', style.font);
          const g = svg.append('g');
          g.selectAll('line.stem').data(data).join('line').attr('x1', x(0)).attr('x2', (d) => x(d[1])).attr('y1', (d) => y(d[0]) + y.bandwidth() / 2).attr('y2', (d) => y(d[0]) + y.bandwidth() / 2).attr('stroke', style.palette[0]).attr('stroke-width', 2);
          g.selectAll('circle').data(data).join('circle').attr('cx', (d) => x(d[1])).attr('cy', (d) => y(d[0]) + y.bandwidth() / 2).attr('r', 5).attr('fill', style.palette[0]);
          g.selectAll('text.value').data(data).join('text').attr('x', (d) => x(d[1]) + 9).attr('y', (d) => y(d[0]) + y.bandwidth() / 2 + 4).attr('font-size', style.small).attr('fill', style.muted).text((d) => fmt(d[1]));
          return svg.node();
        },
      },
      {
        id: 'slopegraph', name: D.t('d3.slope.name'), icon: 'trending-up',
        description: D.t('d3.slope.description'),
        params: [
          { name: 'category', label: D.t('d3.param.category'), type: 'column', kinds: ['text', 'boolean'], required: true },
          { name: 'period', label: D.t('d3.param.period'), type: 'column', kinds: ['text', 'integer', 'date', 'datetime'], required: true },
          { name: 'from', label: D.t('d3.param.from'), type: 'string', required: true },
          { name: 'to', label: D.t('d3.param.to'), type: 'string', required: true },
          { name: 'value', label: D.t('d3.param.value'), type: 'column', kinds: ['integer', 'number'], required: true },
          { name: 'top', label: D.t('d3.param.top'), type: 'number', default: 15 },
          { name: 'format', label: D.t('d3.param.format'), type: 'select', options: locale.NUMBER_FORMATS.map((f) => ({ value: f.pattern, label: f.label })), default: ',.0f' },
        ],
        render(d3, container, rows, p, style, size) {
          const by = new Map();
          for (const r of rows) {
            const per = String(r[p.period]); const v = num(r[p.value]);
            if (!Number.isFinite(v)) continue;
            const key = String(r[p.category]);
            if (!by.has(key)) by.set(key, { key, a: null, b: null });
            if (per === String(p.from)) by.get(key).a = (by.get(key).a || 0) + v;
            if (per === String(p.to)) by.get(key).b = (by.get(key).b || 0) + v;
          }
          const data = Array.from(by.values()).filter((d) => d.a !== null && d.b !== null).sort((x1, x2) => x2.b - x1.b).slice(0, Math.max(1, Number(p.top) || 15));
          const height = size.height || 460;
          const { svg, top } = frame(d3, container, size.width, height, style, p.title, p.subtitle);
          const left = 190; const right = size.width - 190; const bottom = height - 30;
          const all = data.flatMap((d) => [d.a, d.b]);
          const y = d3.scaleLinear().domain([d3.min(all) || 0, d3.max(all) || 1]).nice().range([bottom, top + 20]);
          const fmt = d3.format(p.format || ',.0f');
          svg.append('text').attr('x', left).attr('y', top + 6).attr('text-anchor', 'middle').attr('font-size', style.label).attr('font-weight', 600).attr('fill', style.text).text(String(p.from));
          svg.append('text').attr('x', right).attr('y', top + 6).attr('text-anchor', 'middle').attr('font-size', style.label).attr('font-weight', 600).attr('fill', style.text).text(String(p.to));
          const color = (d) => (d.b > d.a ? style.palette[2] : d.b < d.a ? style.palette[3] : style.faint);
          const g = svg.append('g');
          g.selectAll('line').data(data).join('line').attr('x1', left).attr('x2', right).attr('y1', (d) => y(d.a)).attr('y2', (d) => y(d.b)).attr('stroke', color).attr('stroke-width', 2).attr('opacity', 0.9);
          g.selectAll('circle.a').data(data).join('circle').attr('cx', left).attr('cy', (d) => y(d.a)).attr('r', 3.5).attr('fill', color);
          g.selectAll('circle.b').data(data).join('circle').attr('cx', right).attr('cy', (d) => y(d.b)).attr('r', 3.5).attr('fill', color);
          // Spread labels at least 12 px apart on each side so they do not overlap.
          const placed = (vals, side, key) => { const sorted = vals.slice().sort((u, v) => y(side(u)) - y(side(v))); let last = -Infinity; for (const d of sorted) { let yy = y(side(d)); if (yy - last < 12) yy = last + 12; d[key] = yy; last = yy; } };
          placed(data, (q) => q.a, '_ya'); placed(data, (q) => q.b, '_yb');
          g.selectAll('text.la').data(data).join('text').attr('x', left - 8).attr('y', (d) => d._ya + 4).attr('text-anchor', 'end').attr('font-size', style.small).attr('fill', style.text).text((d) => `${d.key} ${fmt(d.a)}`);
          g.selectAll('text.lb').data(data).join('text').attr('x', right + 8).attr('y', (d) => d._yb + 4).attr('font-size', style.small).attr('fill', style.text).text((d) => `${fmt(d.b)} ${d.key}`);
          return svg.node();
        },
      },
      {
        id: 'pyramid', name: D.t('d3.pyramid.name'), icon: 'align-center-vertical',
        description: D.t('d3.pyramid.description'),
        params: [
          { name: 'group', label: D.t('d3.param.group'), type: 'column', kinds: ['text', 'integer'], required: true },
          { name: 'side', label: D.t('d3.param.side'), type: 'column', kinds: ['text', 'boolean'], required: true },
          { name: 'value', label: D.t('d3.param.value'), type: 'column', kinds: ['integer', 'number'], required: true },
          { name: 'left', label: D.t('d3.param.left'), type: 'string', required: true },
          { name: 'right', label: D.t('d3.param.right'), type: 'string', required: true },
          { name: 'format', label: D.t('d3.param.format'), type: 'select', options: locale.NUMBER_FORMATS.map((f) => ({ value: f.pattern, label: f.label })), default: '~s' },
        ],
        render(d3, container, rows, p, style, size) {
          const sum = (side) => d3.rollup(rows.filter((r) => String(r[p.side]) === String(side)), (v) => d3.sum(v, (r) => num(r[p.value]) || 0), (r) => String(r[p.group]));
          const L = sum(p.left); const R = sum(p.right);
          const groups = Array.from(new Set(rows.map((r) => String(r[p.group]))));
          const rowH = 18; const mid = size.width / 2; const labelW = 40;
          const height = size.height || (groups.length * rowH + 90);
          const { svg, top } = frame(d3, container, size.width, height, style, p.title, p.subtitle);
          const max = d3.max(groups, (g) => Math.max(L.get(g) || 0, R.get(g) || 0)) || 1;
          const xl = d3.scaleLinear().domain([0, max]).range([mid - labelW, 24]);
          const xr = d3.scaleLinear().domain([0, max]).range([mid + labelW, size.width - 24]);
          const y = d3.scaleBand().domain(groups).range([top + 16, top + 16 + groups.length * rowH]).padding(0.15);
          const fmt = d3.format(p.format || '~s');
          svg.append('text').attr('x', mid - labelW - 4).attr('y', top + 8).attr('text-anchor', 'end').attr('font-size', style.label).attr('font-weight', 600).attr('fill', style.palette[1]).text(String(p.left));
          svg.append('text').attr('x', mid + labelW + 4).attr('y', top + 8).attr('font-size', style.label).attr('font-weight', 600).attr('fill', style.palette[0]).text(String(p.right));
          const g = svg.append('g');
          g.selectAll('rect.l').data(groups).join('rect').attr('x', (d) => xl(L.get(d) || 0)).attr('y', (d) => y(d)).attr('width', (d) => xl(0) - xl(L.get(d) || 0)).attr('height', y.bandwidth()).attr('fill', style.palette[1]);
          g.selectAll('rect.r').data(groups).join('rect').attr('x', xr(0)).attr('y', (d) => y(d)).attr('width', (d) => xr(R.get(d) || 0) - xr(0)).attr('height', y.bandwidth()).attr('fill', style.palette[0]);
          g.selectAll('text.g').data(groups).join('text').attr('x', mid).attr('y', (d) => y(d) + y.bandwidth() / 2 + 4).attr('text-anchor', 'middle').attr('font-size', style.small).attr('fill', style.text).text((d) => d);
          const base = top + 16 + groups.length * rowH;
          styleAxis(svg.append('g').attr('transform', `translate(0,${base})`).call(d3.axisBottom(xl).ticks(4).tickFormat(fmt)), style);
          styleAxis(svg.append('g').attr('transform', `translate(0,${base})`).call(d3.axisBottom(xr).ticks(4).tickFormat(fmt)), style);
          return svg.node();
        },
      },
    ];

    function get(id) { return templates.find((t) => t.id === id) || null; }

    /**
     * Render a template into a container (which may be detached).
     * @returns {Promise<SVGSVGElement>}
     */
    async function render(templateId, container, rows, params, options = {}) {
      const d3 = await ensureD3();
      const tpl = get(templateId);
      if (!tpl) throw new Error(D.t('d3.err.unknown', { template: templateId }));
      for (const p of tpl.params) if (p.required && (params[p.name] === undefined || params[p.name] === null || params[p.name] === '')) throw new Error(D.t('common.err.required', { name: p.label }));
      const style = theme.d3Style();
      const size = { width: options.width || 720, height: options.height || 0 };
      return tpl.render(d3, container, rows, params, style, size);
    }
    function svgString(svg) {
      const clone = /** @type {SVGSVGElement} */ (svg.cloneNode(true));
      clone.setAttribute('xmlns', SVG_NS);
      return new XMLSerializer().serializeToString(clone);
    }

    return { templates, get, render, ensureD3, svgString };
  });
})();
