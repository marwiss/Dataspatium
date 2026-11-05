// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The Fråga tab in Söka: a visual query over one or several datasets (analysis/querybuilder). Datasets and
 * joins, columns with aggregates, conditions in groups, sorting and a row limit; the generated SQL is shown and
 * can be opened in Analysera, and the result can be saved as a list (kind query) or as a new dataset.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/soka/query', ['ui/base', 'analysis/querybuilder', 'data/lists'], (base, qb, lists) => {
    const { h, t, i18n, replace } = base;
    const CMP_KEYS = { '=': 'eq', '!=': 'ne', '>': 'gt', '>=': 'ge', '<': 'lt', '<=': 'le', contains: 'contains', startswith: 'startswith', in: 'in', between: 'between', empty: 'empty', notempty: 'notempty' };

    /** @param {any} ctx */
    function create(ctx) {
      const { ui, store, shell } = ctx;
      const el = h('div', { class: 'dm-stack' });
      const state = { spec: null, metas: new Map(), result: null, error: null, running: false, list: null };
      const fail = (err) => { state.error = String((err && err.message) || err); shell.log(state.error, 'error'); render(); };
      const datasetsNow = () => store.get().datasets;

      async function ensureSpec() {
        if (!state.spec) {
          const s = store.get();
          const id = s.selectedId && s.datasets.some((d) => d.id === s.selectedId) ? s.selectedId : (s.datasets[0] ? s.datasets[0].id : null);
          if (id) state.spec = qb.empty(id);
        }
        await refreshMetas();
      }
      async function refreshMetas() {
        if (!state.spec) { state.metas = new Map(); return; }
        try { state.metas = await qb.metasFor(state.spec); } catch (err) { state.metas = new Map(); state.error = (err && err.message) || String(err); }
      }
      /** Sources in order: 0 = primary, n = n-th join; each with its metadata. */
      function sources() {
        const s = state.spec;
        if (!s) return [];
        return [{ index: 0, meta: state.metas.get(s.from.datasetId) }].concat((s.joins || []).map((j, i) => ({ index: i + 1, meta: state.metas.get(j.datasetId) }))).filter((x) => x.meta);
      }
      const label = (src, column) => `${src.meta.shortName || src.meta.name}.${column}`;
      function columnOptions() {
        const out = [];
        for (const src of sources()) for (const c of src.meta.columns) out.push({ value: `${src.index}:${c.name}`, label: label(src, c.name) });
        return out;
      }
      const parseRef = (v) => { const i = String(v).indexOf(':'); return { source: Number(String(v).slice(0, i)) || 0, column: String(v).slice(i + 1) }; };
      function select(labelText, options, value, onChange, extra = {}) {
        const sel = /** @type {any} */ (h('dm-select', Object.assign({ label: labelText }, extra)));
        sel.options = options;
        sel.value = value;
        sel.addEventListener('change', () => onChange(sel.value));
        return sel;
      }

      // ---- cards ----
      function datasetsCard() {
        const spec = state.spec;
        const all = datasetsNow();
        const primary = select(t('fraga.primary'), all.map((d) => ({ value: d.id, label: d.name })), spec.from.datasetId, async (v) => { state.spec = qb.empty(v); state.result = null; state.list = null; await refreshMetas(); render(); });
        const joinable = all.filter((d) => d.id !== spec.from.datasetId && d.shortName);
        const primaryMeta = state.metas.get(spec.from.datasetId);
        const joinRows = (spec.joins || []).map((j, ji) => {
          const jm = state.metas.get(j.datasetId);
          const dsSel = select(t('fraga.join.dataset'), joinable.map((d) => ({ value: d.id, label: d.name })), j.datasetId, async (v) => { j.datasetId = v; j.on = [{ left: '', right: '' }]; await refreshMetas(); render(); });
          const typeSel = select(t('fraga.join.type'), [{ value: 'inner', label: t('fraga.join.type.inner') }, { value: 'left', label: t('fraga.join.type.left') }], j.type || 'inner', (v) => { j.type = v; });
          const keys = (j.on || []).map((pair, pi) => h('div', { class: 'dm-row-wrap' },
            select(t('fraga.join.key.left', { name: primaryMeta ? (primaryMeta.shortName || primaryMeta.name) : '' }), [{ value: '', label: '–' }].concat((primaryMeta ? primaryMeta.columns : []).map((c) => ({ value: c.name, label: c.name }))), pair.left || '', (v) => { pair.left = v; }),
            select(t('fraga.join.key.right', { name: jm ? (jm.shortName || jm.name) : '' }), [{ value: '', label: '–' }].concat((jm ? jm.columns : []).map((c) => ({ value: c.name, label: c.name }))), pair.right || '', (v) => { pair.right = v; }),
            pi > 0 ? ui.button({ label: t('fraga.remove'), icon: 'x', 'icon-only': true, size: 'sm', variant: 'ghost', onClick: () => { j.on.splice(pi, 1); render(); } }) : null));
          return h('div', { class: 'dm-fraga-join dm-stack-sm' },
            h('div', { class: 'dm-row-wrap' }, dsSel, typeSel, ui.button({ label: t('fraga.join.remove'), icon: 'trash-2', size: 'sm', variant: 'ghost', onClick: () => { spec.joins.splice(ji, 1); spec.columns = spec.columns.filter((c) => (c.source || 0) !== ji + 1).map((c) => ((c.source || 0) > ji + 1 ? Object.assign({}, c, { source: c.source - 1 }) : c)); render(); } })),
            h('div', { class: 'dm-stack-xs' }, keys),
            h('div', null, ui.button({ label: t('fraga.join.key.add'), icon: 'plus', size: 'sm', onClick: () => { j.on.push({ left: '', right: '' }); render(); } })));
        });
        return h('div', { class: 'dm-card dm-stack' },
          h('h3', { text: t('fraga.datasets') }),
          primary,
          joinRows.length ? h('div', { class: 'dm-stack-sm' }, joinRows) : null,
          h('div', { class: 'dm-row-wrap' },
            ui.button({ label: t('fraga.join.add'), icon: 'link', size: 'sm', disabled: !joinable.length, onClick: async () => { spec.joins.push({ datasetId: joinable[0].id, type: 'inner', on: [{ left: '', right: '' }] }); await refreshMetas(); render(); } }),
            !joinable.length && all.length > 1 ? h('span', { class: 'dm-help', text: t('fraga.noshort') }) : null));
      }

      function columnsCard() {
        const spec = state.spec;
        const opts = columnOptions();
        const srcs = sources();
        const rows = (spec.columns || []).map((c, ci) => {
          const src = srcs.find((s) => s.index === (c.source || 0));
          const agg = select(t('fraga.agg'), [{ value: '', label: t('fraga.agg.none') }].concat(qb.AGGS.map((a) => ({ value: a, label: t('fraga.agg.' + a) }))), c.agg || '', (v) => { c.agg = v || null; });
          const alias = /** @type {any} */ (h('dm-input', { label: t('fraga.alias'), placeholder: c.agg ? `${c.agg}_${c.column}` : c.column }));
          alias.value = c.alias || '';
          alias.addEventListener('change', () => { c.alias = alias.value.trim() || undefined; });
          return h('div', { class: 'dm-row-wrap dm-fraga-row' }, h('strong', { class: 'dm-fraga-ref', text: src ? label(src, c.column) : c.column }), agg, alias,
            ui.button({ label: t('fraga.remove'), icon: 'x', 'icon-only': true, size: 'sm', variant: 'ghost', onClick: () => { spec.columns.splice(ci, 1); render(); } }));
        });
        const add = select(t('fraga.columns.add'), [{ value: '', label: '–' }].concat(opts), '', (v) => { if (!v) return; const ref = parseRef(v); spec.columns.push({ source: ref.source, column: ref.column, agg: null }); render(); });
        const allBtns = srcs.map((src) => ui.button({ label: t('fraga.columns.all', { name: src.meta.shortName || src.meta.name }), icon: 'columns-3', size: 'sm', onClick: () => { for (const c of src.meta.columns) if (!spec.columns.some((x) => (x.source || 0) === src.index && x.column === c.name)) spec.columns.push({ source: src.index, column: c.name, agg: null }); render(); } }));
        return h('div', { class: 'dm-card dm-stack' }, h('h3', { text: t('fraga.columns') }), rows.length ? h('div', { class: 'dm-stack-sm' }, rows) : h('p', { class: 'dm-help', text: t('fraga.columns.none') }), h('div', { class: 'dm-row-wrap' }, add, allBtns));
      }

      /** What the main dataset of the question can be asked for, beyond its columns. */
      async function specialsOf() {
        const id = state.spec && state.spec.from && state.spec.from.datasetId;
        const ds = datasetsNow().find((d) => d.id === id);
        if (!ds) return [];
        const kinds = D.require('data/kinds');
        const profile = kinds.of(ds);
        const out = [];
        if (profile.sideSearch && profile.sideSearch.table === '_properties' && !kinds.isDxf(ds)) out.push('property');
        if (profile.cypher) out.push('neighbour', 'within');
        if (await D.require('data/facets').has(id, 'spatial').catch(() => false) || ds.kind === 'plan') out.push('place');
        return out;
      }
      function removeButton(parent, idx) {
        return ui.button({ label: t('fraga.remove'), icon: 'x', 'icon-only': true, size: 'sm', variant: 'ghost', onClick: () => { parent.items.splice(idx, 1); render(); } });
      }
      const fieldOf = (label, value, onChange, attrs = {}) => {
        const el = /** @type {any} */ (h('dm-input', Object.assign({ label }, attrs)));
        el.value = value === undefined || value === null ? '' : String(value);
        el.addEventListener('change', () => onChange(el.value));
        return el;
      };
      /** A condition that belongs to the kind of dataset. */
      function specialRow(item, parent, idx) {
        const title = h('strong', { class: 'dm-small', text: t('fraga.special.' + item.special) });
        if (item.special === 'neighbour' || item.special === 'within') {
          const parts = [fieldOf(t('fraga.special.of'), item.of, (v) => { item.of = v; }, { help: t('fraga.special.of.help') })];
          if (item.special === 'within') parts.push(fieldOf(t('fraga.special.steps'), item.steps || 2, (v) => { item.steps = v; }, { type: 'number', min: '1', max: String(qb.MAX_STEPS) }));
          return h('div', { class: 'dm-card dm-stack-sm' }, title, h('div', { class: 'dm-row-wrap dm-fraga-row' }, ...parts, removeButton(parent, idx)));
        }
        if (item.special === 'place') {
          item.place = item.place || {};
          return h('div', { class: 'dm-card dm-stack-sm' }, h('div', { class: 'dm-row-wrap dm-fraga-row' }, title, removeButton(parent, idx)), D.require('ui/soka/place-form').create(item.place), h('p', { class: 'dm-help dm-small', text: t('soka.place.help') }));
        }
        const nameSel = /** @type {any} */ (h('dm-select', { label: t('fraga.special.property.name') }));
        nameSel.options = [{ value: '', label: t('common.loading') }];
        D.require('analysis/model').propertyNames(state.spec.from.datasetId).then((names) => {
          nameSel.options = names.map((n) => ({ value: `${n.set}\u0000${n.name}`, label: `${n.set}: ${n.name}` }));
          if (!item.set && names[0]) { item.set = names[0].set; item.name = names[0].name; }
          nameSel.value = `${item.set}\u0000${item.name}`;
        }).catch((err) => D.log('fraga', err));
        nameSel.addEventListener('change', () => { const [set, name] = nameSel.value.split('\u0000'); item.set = set; item.name = name; });
        const cmp = select(t('fraga.where.cmp'), ['=', '!=', 'contains', '>', '<'].map((c) => ({ value: c, label: t('fraga.cmp.' + CMP_KEYS[c]) })), item.cmp || '=', (v) => { item.cmp = v; });
        return h('div', { class: 'dm-card dm-stack-sm' }, title, h('div', { class: 'dm-row-wrap dm-fraga-row' }, nameSel, cmp, fieldOf(t('fraga.where.value'), item.value, (v) => { item.value = v; }), removeButton(parent, idx)));
      }
      function conditionRow(item, parent, idx) {
        if (item.special) return specialRow(item, parent, idx);
        const opts = columnOptions();
        const ref = select(t('fraga.where.column'), opts, `${item.source || 0}:${item.column}`, (v) => { const r = parseRef(v); item.source = r.source; item.column = r.column; });
        const cmp = select(t('fraga.where.cmp'), qb.CMP.map((c) => ({ value: c, label: t('fraga.cmp.' + CMP_KEYS[c]) })), item.cmp || '=', (v) => { item.cmp = v; render(); });
        const hidden = item.cmp === 'empty' || item.cmp === 'notempty';
        const val = /** @type {any} */ (h('dm-input', { label: t('fraga.where.value'), placeholder: item.cmp === 'in' ? t('fraga.where.value.in') : item.cmp === 'between' ? t('fraga.where.value.between') : '' }));
        val.value = Array.isArray(item.value) ? item.value.join(', ') : (item.value === undefined || item.value === null ? '' : String(item.value));
        val.addEventListener('change', () => { item.value = val.value; });
        return h('div', { class: 'dm-row-wrap dm-fraga-row' }, ref, cmp, hidden ? null : val,
          ui.button({ label: t('fraga.remove'), icon: 'x', 'icon-only': true, size: 'sm', variant: 'ghost', onClick: () => { parent.items.splice(idx, 1); render(); } }));
      }
      function groupEl(group, depth, parent, idx) {
        const opSel = select(t('fraga.where.op'), [{ value: 'and', label: t('fraga.where.all') }, { value: 'or', label: t('fraga.where.any') }], group.op || 'and', (v) => { group.op = v; }, { inline: true });
        const items = (group.items || []).map((it, i) => (it.items ? groupEl(it, depth + 1, group, i) : conditionRow(it, group, i)));
        const first = opts0();
        const buttons = h('div', { class: 'dm-row-wrap' },
          ui.button({ label: t('fraga.where.add'), icon: 'plus', size: 'sm', disabled: !first, onClick: () => { group.items.push({ source: first.source, column: first.column, cmp: '=', value: '' }); render(); } }),
          depth < 1 ? ui.button({ label: t('fraga.where.group'), icon: 'braces', size: 'sm', disabled: !first, onClick: () => { group.items.push({ op: group.op === 'and' ? 'or' : 'and', items: [{ source: first.source, column: first.column, cmp: '=', value: '' }] }); render(); } }) : null,
          parent ? ui.button({ label: t('fraga.remove'), icon: 'x', 'icon-only': true, size: 'sm', variant: 'ghost', onClick: () => { parent.items.splice(idx, 1); render(); } }) : null);
        // Conditions that belong to the kind come when the dataset is known to have them.
        specialsOf().then((list) => {
          for (const id of list) buttons.appendChild(ui.button({ label: t('fraga.special.' + id), icon: 'plus', size: 'sm', title: t('fraga.special.' + id + '.hint'), onClick: () => { group.items.push({ special: id, cmp: '=', steps: 2 }); render(); } }));
        }).catch((err) => D.log('fraga', err));
        return h('div', { class: depth ? 'dm-fraga-group dm-stack-sm' : 'dm-stack-sm' }, h('div', { class: 'dm-row-wrap' }, opSel), items.length ? h('div', { class: 'dm-stack-xs' }, items) : null, buttons);
      }
      function opts0() { const o = columnOptions()[0]; return o ? parseRef(o.value) : null; }
      function whereCard() { return h('div', { class: 'dm-card dm-stack' }, h('h3', { text: t('fraga.where') }), groupEl(state.spec.where, 0, null, 0)); }

      function orderCard() {
        const spec = state.spec;
        const aliases = (spec.columns || []).map((c) => c.alias || (c.agg ? `${c.agg}_${c.column}` : c.column));
        const first = spec.orderBy[0] || null;
        const by = select(t('fraga.order'), [{ value: '', label: t('fraga.order.none') }].concat(aliases.map((a) => ({ value: a, label: a }))), first ? first.alias : '', (v) => { spec.orderBy = v ? [{ alias: v, dir: first ? first.dir : 'asc' }] : []; render(); });
        const dir = select(t('fraga.order.dir'), [{ value: 'asc', label: t('fraga.order.asc') }, { value: 'desc', label: t('fraga.order.desc') }], first ? first.dir : 'asc', (v) => { if (spec.orderBy[0]) spec.orderBy[0].dir = v; });
        const limit = /** @type {any} */ (h('dm-input', { type: 'number', label: t('fraga.limit'), min: '1' }));
        limit.value = String(spec.limit || qb.DEFAULT_LIMIT);
        limit.addEventListener('change', () => { spec.limit = Math.max(1, Number(limit.value) || qb.DEFAULT_LIMIT); });
        return h('div', { class: 'dm-card dm-stack' }, h('h3', { text: t('fraga.order.title') }), h('div', { class: 'dm-row-wrap' }, by, first ? dir : null, limit));
      }

      function actionsRow() {
        const errors = state.spec ? qb.validate(state.spec, state.metas) : [t('fraga.err.nofrom')];
        const runBtn = ui.button({ label: t('fraga.run'), icon: 'play', variant: 'primary', loading: state.running, disabled: !!errors.length, onClick: () => run() });
        return h('div', { class: 'dm-stack-sm' },
          h('div', { class: 'dm-row-wrap' }, runBtn,
            ui.button({ label: t('fraga.open.sql'), icon: 'database', disabled: !!errors.length, onClick: () => openInAnalysera() }),
            ui.button({ label: t('fraga.save.list'), icon: 'list-checks', disabled: !!errors.length, onClick: () => saveAsList() }),
            ui.button({ label: t('fraga.save.dataset'), icon: 'table', disabled: !!errors.length, onClick: () => saveAsDataset() })),
          errors.length ? h('p', { class: 'dm-help', text: errors[0] }) : null);
      }

      function resultCard() {
        if (state.error && !state.result) return h('p', { class: 'dm-error', text: state.error });
        const r = state.result;
        if (!r) return h('p', { class: 'dm-help', text: t('fraga.empty') });
        const table = /** @type {any} */ (h('dm-table', { class: 'dm-search-table', 'aria-label': t('fraga.results') }));
        table.setData({ columns: r.columns.map((c) => ({ key: c, label: c })), rowCount: r.values.length, rowProvider: async (start, count) => r.values.slice(start, start + count), sort: null });
        const copy = ui.button({ label: t('fraga.copy'), icon: 'copy', size: 'sm', onClick: () => navigator.clipboard.writeText(r.sql).then(() => ui.toast.show(t('devices.copied'), { kind: 'ok' })).catch(() => {}) });
        return h('div', { class: 'dm-card dm-stack' },
          h('div', { class: 'dm-search-head' }, h('h3', { text: t('fraga.results') }), h('dm-badge', { kind: 'accent', text: r.truncated ? t('fraga.rows.truncated', { n: i18n.formatNumber(r.values.length) }) : t('fraga.rows', { n: i18n.formatNumber(r.values.length) }) })),
          table,
          h('div', { class: 'dm-row-wrap' }, h('strong', { text: t('fraga.sql') }), copy),
          h('pre', { class: 'dm-fraga-sql', text: r.sql }));
      }

      function render() {
        if (!state.spec) { replace(el, h('dm-empty-state', { icon: 'filter', heading: t('soka.tabs.fraga'), text: t('shell.no.datasets.hint') })); return; }
        if (!state.metas.get(state.spec.from.datasetId)) { replace(el, h('p', { class: 'dm-help', text: state.error || t('fraga.err.missing') })); return; }
        replace(el, datasetsCard(), columnsCard(), whereCard(), orderCard(), actionsRow(), resultCard());
      }

      // ---- actions ----
      async function run() {
        if (!state.spec) return;
        state.running = true; state.error = null; render();
        try { state.result = await qb.run(state.spec); if (state.list) { state.list.hits = state.result.values.length; } }
        catch (err) { state.result = null; state.error = (err && err.message) || String(err); shell.log(state.error, 'error'); }
        state.running = false;
        render();
        return state.result;
      }
      function compiled() { return qb.compile(state.spec, state.metas); }
      function openInAnalysera() {
        try {
          const { sql } = compiled();
          store.set({ selectedId: state.spec.from.datasetId });
          shell.activate('analysera');
          store.set({ pendingCode: { lang: 'sql', code: sql } });
        } catch (err) { fail(err); }
      }
      async function saveAsList(name) {
        try {
          const { sql } = compiled();
          const metas = state.metas;
          const suggested = state.list ? state.list.name : qb.describe(state.spec, metas).slice(0, 60);
          const given = name !== undefined ? name : await ui.dialog.prompt(t('fraga.list.name'), { title: t('fraga.save.list'), value: suggested });
          if (given === null) return null;
          const rec = await lists.save({ id: state.list ? state.list.id : undefined, name: given, datasetId: state.spec.from.datasetId, kind: 'query', spec: state.spec, sql, hits: state.result ? state.result.values.length : null, createdAt: state.list ? state.list.createdAt : undefined });
          state.list = rec;
          shell.log(t('fraga.list.saved', { name: rec.name }), 'ok');
          ui.toast.show(t('fraga.list.saved', { name: rec.name }), { kind: 'ok' });
          return rec;
        } catch (err) { fail(err); return null; }
      }
      async function saveAsDataset(name) {
        try {
          const suggested = state.list ? state.list.name : qb.describe(state.spec, state.metas).slice(0, 60);
          const given = name !== undefined ? name : await ui.dialog.prompt(t('fraga.dataset.name'), { title: t('fraga.save.dataset'), value: suggested });
          if (given === null) return null;
          const meta = await qb.toDataset(state.spec, given);
          shell.log(t('soka.list.dataset.done', { name: meta.name, n: i18n.formatNumber(meta.rowCount || 0) }), 'ok');
          ui.toast.show(t('soka.list.dataset.done', { name: meta.name, n: i18n.formatNumber(meta.rowCount || 0) }), { kind: 'ok' });
          return meta;
        } catch (err) { fail(err); return null; }
      }
      async function setSpec(spec) { state.spec = JSON.parse(JSON.stringify(spec)); state.result = null; state.error = null; state.list = null; await refreshMetas(); render(); }
      async function setList(rec) { await setSpec(rec.spec); state.list = rec; return run(); }

      return {
        el, render, run, setSpec, setList, saveAsList, saveAsDataset, openInAnalysera,
        get state() { return state; },
        async show() { await ensureSpec(); render(); },
        destroy() { state.result = null; },
      };
    }
    return { create };
  });
})();
