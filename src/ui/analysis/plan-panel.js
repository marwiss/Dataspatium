// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The Plan tab in Analysera for datasets of kind "plan": a summary of the plan, the provisions per area as a table,
 * areas per use (or per land and water use type for a comprehensive plan), a check of every catalogue reference
 * against Boverket's Planbestämmelsekatalogen (embedded copy), and free-text search in the catalogue. Every result
 * can be saved as a dataset. Pure logic lives in data/plan and data/plan-catalog.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/analysis/plan-panel', ['ui/base', 'data/datasets', 'data/plan', 'data/plan-catalog', 'viz/data', 'platform/files'], (base, datasets, plan, catalog, vizData, files) => {
    const { h, t, i18n, replace } = base;
    const TOOLS = ['summary', 'provisions', 'areas', 'catalog', 'search'];
    const PREVIEW_ROWS = 2000;
    const MAX_ROWS = 20000;
    const STATE_KIND = { ok: 'ok', ersatt: 'warn', upphord: 'warn', okand: 'error', saknas: null };

    /**
     * @param {any} ctx shell context @param {{rerenderRight?: () => void}} [options]
     */
    function create(ctx, options = {}) {
      const { ui, store, shell } = ctx;
      const s = { tool: 'summary', query: '', typ: '', form: '', current: true, lastSearch: null };
      let fieldsEl = null; let resultEl = null; let seq = 0;
      let cache = { id: null, updatedAt: null, rows: [], check: null };

      const selected = () => { const st = store.get(); return st.datasets.find((d) => d.id === st.selectedId) || null; };
      const usable = (ds) => !!ds && ds.kind === 'plan';
      const slagOf = (ds) => (ds && ds.plan && ds.plan.slag === 'oversiktsplan' ? 'oversiktsplan' : 'detaljplan');
      async function rowsOf(ds) {
        if (cache.id === ds.id && cache.updatedAt === ds.updatedAt) return cache.rows;
        const cols = await datasets.columns(ds.id);
        const data = await vizData.fetchRows(ds.id, { fields: cols.map((c) => c.name), limit: MAX_ROWS });
        cache = { id: ds.id, updatedAt: ds.updatedAt, rows: data.rows, check: null };
        return cache.rows;
      }
      async function checkOf(ds) {
        const rows = await rowsOf(ds);
        if (!cache.check) cache.check = await plan.checkCatalog(rows);
        return cache.check;
      }

      function center() {
        const head = h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon('layers', 20), t('plan.tool.title')));
        const tabs = /** @type {any} */ (h('dm-tabs'));
        tabs.tabs = TOOLS.map((id) => ({ id, label: t('plan.tool.' + id) }));
        tabs.active = s.tool;
        tabs.addEventListener('dm-change', (e) => { s.tool = /** @type {any} */ (e).detail.id; renderFields(); renderResult(); if (options.rerenderRight) options.rerenderRight(); });
        fieldsEl = h('div', { class: 'dm-stack-sm' });
        resultEl = h('div', { class: 'dm-tool-result dm-center-fill' });
        renderFields(); renderResult();
        return { head, body: [tabs, fieldsEl, resultEl] };
      }

      function renderFields() {
        if (!fieldsEl) return;
        const ds = selected();
        if (s.tool === 'search') {
          const q = /** @type {any} */ (h('dm-input', { label: t('plan.search.query'), placeholder: t('plan.search.placeholder') }));
          q.value = s.query;
          q.addEventListener('input', () => { s.query = q.value; });
          q.addEventListener('keydown', (e) => { if (/** @type {KeyboardEvent} */ (e).key === 'Enter') renderResult(); });
          const typ = select(t('plan.search.typ'), [{ value: '', label: t('plan.search.all') }].concat(catalog.TYPES.map((v) => ({ value: v, label: t('plan.type.' + v) }))), s.typ, (v) => { s.typ = v; });
          const form = select(t('plan.field.anvandningsform'), [{ value: '', label: t('plan.search.all') }].concat(['Kvartersmark', 'Allmän plats', 'Vattenområde', 'Planområdet'].map((v) => ({ value: v, label: v }))), s.form, (v) => { s.form = v; });
          const cur = /** @type {any} */ (h('dm-switch', { label: t('plan.search.current') }));
          cur.checked = s.current;
          cur.addEventListener('change', () => { s.current = cur.checked; });
          replace(fieldsEl, h('div', { class: 'dm-form-grid' }, q, typ, form), h('div', { class: 'dm-row-wrap' }, cur, ui.button({ label: t('common.search'), icon: 'search', variant: 'primary', onClick: () => renderResult() })),
            h('p', { class: 'dm-help dm-xs', text: t('plan.search.source') }));
          return;
        }
        if (!usable(ds)) { replace(fieldsEl, h('dm-empty-state', { icon: 'layers', heading: t('plan.tool.empty'), text: t('plan.tool.empty.hint') })); return; }
        replace(fieldsEl, h('p', { class: 'dm-help', text: t('plan.tool.about.' + s.tool + (slagOf(ds) === 'oversiktsplan' && (s.tool === 'provisions' || s.tool === 'areas') ? '.op' : '')) }));
      }

      async function renderResult() {
        if (!resultEl) return;
        const my = ++seq;
        const ds = selected();
        if (s.tool !== 'search' && !usable(ds)) { replace(resultEl); return; }
        replace(resultEl, h('p', { class: 'dm-help', text: t('common.loading') }));
        try {
          const out = await compute(ds);
          if (my !== seq) return;
          if (!out) { replace(resultEl); return; }
          showTable(out, ds);
        } catch (err) {
          if (my !== seq) return;
          replace(resultEl, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) }));
        }
      }
      const col = (name, type = 'text', label) => ({ name, type, label: label || t('plan.col.' + name) });
      const typeLabel = (typ) => (D.require('ui/i18n').has('plan.type.' + typ) ? t('plan.type.' + typ) : typ);
      const themeLabel = (key) => (D.require('ui/i18n').has('plan.theme.' + key) ? t('plan.theme.' + key) : key);

      /** The table of the active tool: {columns, rows, note, name}. */
      async function compute(ds) {
        if (s.tool === 'search') {
          if (!s.query.trim() && !s.typ && !s.form) return { columns: [col('beteckning'), col('formulering')], rows: [], note: t('plan.search.hint'), name: t('plan.tool.search') };
          const hits = await catalog.search(s.query, { typ: s.typ || undefined, form: s.form || undefined, current: s.current, limit: 500 });
          s.lastSearch = hits.length;
          const cat = await catalog.load();
          return {
            columns: [col('typ'), col('anvandningsform'), col('beteckning'), col('kod'), col('formulering'), col('kategori'), col('underkategori'), col('farg'), col('start'), col('slut'), col('uuid')],
            rows: hits.map((r) => [typeLabel(r.typ), r.form, r.beteckning, r.kod, r.formulering, r.kategori, r.underkategori, r.farg, r.start, r.slut, r.uuid]),
            note: t('plan.search.result', { n: i18n.formatNumber(hits.length), release: cat.release }), name: t('plan.search.dataset', { q: s.query.trim() || t('plan.search.all') }),
          };
        }
        const rows = await rowsOf(ds);
        const op = slagOf(ds) === 'oversiktsplan';
        if (s.tool === 'summary') {
          const info = ds.plan || {};
          const counts = op ? countBy(rows, (r) => r.tema) : countBy(rows, (r) => r.objekttyp);
          const list = [
            [t('plan.field.slag'), t('plan.slag.' + slagOf(ds))], [t('common.name'), info.namn || ds.name], info.beteckning && [t('plan.field.beteckning'), info.beteckning],
            (info.kommun || info.kommunkod) && [t('plan.field.kommun'), [info.kommun, info.kommunkod].filter(Boolean).join(' ')], info.typ && [t('plan.field.typ'), info.typ], info.status && [t('plan.field.status'), info.status],
            info.datumPaborjat && [t('plan.field.paborjat'), info.datumPaborjat], info.datumAntagande && [t('plan.field.antagande'), info.datumAntagande], info.datumLagakraft && [t('plan.field.lagakraft'), info.datumLagakraft],
            info.genomforandetid && [t('plan.field.genomforandetid'), info.genomforandetid], info.anvandbarhet && [t('plan.field.anvandbarhet'), info.anvandbarhet], info.syfte && [t('plan.field.syfte'), info.syfte],
            [t('plan.field.objects'), i18n.formatNumber(rows.length)],
          ].filter(Boolean);
          for (const [k, n] of Object.entries(counts)) list.push([op ? themeLabel(k) : typeLabel(k), i18n.formatNumber(n)]);
          if (!op) {
            const check = await checkOf(ds);
            const c = check.counts;
            list.push([t('plan.catalog.release'), check.release], [t('plan.state.ok'), i18n.formatNumber(c.ok || 0)], [t('plan.state.ersatt'), i18n.formatNumber(c.ersatt || 0)], [t('plan.state.upphord'), i18n.formatNumber(c.upphord || 0)], [t('plan.state.okand'), i18n.formatNumber(c.okand || 0)], [t('plan.state.saknas'), i18n.formatNumber(c.saknas || 0)]);
            const areaTotal = plan.areasByUse(rows, 'detaljplan').reduce((sum, e) => sum + e.area, 0);
            if (areaTotal) list.push([t('plan.col.area_ha'), i18n.formatNumber(Math.round(areaTotal / 100) / 100)]);
          }
          return { columns: [col('falt'), col('varde')], rows: list.map(([k, v]) => [k, String(v)]), note: t('plan.tool.about.summary'), name: t('plan.summary.dataset', { name: ds.name }) };
        }
        if (s.tool === 'provisions') {
          if (op) {
            return { columns: [col('tema'), col('innehallstyp'), col('namn'), col('precisering'), col('kompletterande'), col('anvandningsstatus'), col('planhandelse'), col('planhandelse_datum'), col('geometrityp')],
              rows: rows.map((r) => [themeLabel(r.tema), r.innehallstyp, r.namn, r.precisering, r.kompletterande, r.anvandningsstatus, r.planhandelse, r.planhandelse_datum, r.geometrityp]), note: t('plan.provisions.note.op', { n: i18n.formatNumber(rows.length) }), name: t('plan.provisions.dataset', { name: ds.name }) };
          }
          const check = await checkOf(ds);
          const stateOf = new Map(check.items.map((i) => [i.row, i]));
          const list = rows.filter((r) => r.objekttyp !== 'planomrade');
          return {
            columns: [col('objekttyp'), col('beteckning'), col('formulering'), col('kategori'), col('underkategori'), col('anvandningsform'), col('varde'), col('kod'), col('katalogstatus'), col('katalogreferens')],
            rows: list.map((r) => { const c = stateOf.get(r); return [typeLabel(r.objekttyp), r.beteckning, r.formulering, r.kategori, r.underkategori, r.anvandningsform, [r.vardetyp, r.varde, r.enhet].filter(Boolean).join(' '), r.kod || (c && c.entry ? c.entry.kod : ''), c ? t('plan.state.' + c.state) : '', r.katalogreferens]; }),
            note: t('plan.provisions.note', { n: i18n.formatNumber(list.length) }), name: t('plan.provisions.dataset', { name: ds.name }), markdown: true,
          };
        }
        if (s.tool === 'areas') {
          const areas = plan.areasByUse(rows, op ? 'oversiktsplan' : 'detaljplan');
          return {
            columns: [col(op ? 'innehallstyp' : 'beteckning'), col('formulering'), col('antal', 'integer'), col('area_m2', 'number'), col('area_ha', 'number'), col('andel_procent', 'number')],
            rows: areas.map((e) => [e.key, e.label, e.count, Math.round(e.area), Math.round(e.area / 100) / 100, Math.round(e.share * 1000) / 10]),
            note: t('plan.areas.note', { n: i18n.formatNumber(areas.length), total: i18n.formatNumber(Math.round(areas.reduce((sum, e) => sum + e.area, 0) / 100) / 100) }), name: t('plan.areas.dataset', { name: ds.name }),
          };
        }
        if (s.tool === 'catalog') {
          if (op) return { columns: [col('falt'), col('varde')], rows: [], note: t('plan.catalog.notforop'), name: '' };
          const check = await checkOf(ds);
          return {
            columns: [col('katalogstatus'), col('beteckning'), col('formulering'), col('katalogreferens'), col('kod'), col('katalogformulering'), col('formulering_stammer'), col('ersatts_av'), col('giltig')],
            rows: check.items.map((i) => [t('plan.state.' + i.state), i.row.beteckning, i.row.formulering, i.row.katalogreferens, i.entry ? i.entry.kod : '', i.entry ? i.entry.formulering : '', i.entry ? (i.formulationMatches ? t('common.yes') : t('common.no')) : '', i.replacement ? `${i.replacement.kod || i.replacement.beteckning} (${i.replacement.uuid})` : '', i.entry ? `${i.entry.start || ''} – ${catalog.isCurrent(i.entry) ? t('plan.catalog.current') : i.entry.slut || ''}` : '']),
            note: t('plan.catalog.note', { release: check.release, ok: i18n.formatNumber(check.counts.ok || 0), other: i18n.formatNumber(check.items.length - (check.counts.ok || 0)) }), name: t('plan.catalog.dataset', { name: ds.name }),
          };
        }
        return null;
      }
      function countBy(rows, fn) { const out = {}; for (const r of rows) { const k = fn(r) || '?'; out[k] = (out[k] || 0) + 1; } return out; }

      function showTable(out, ds) {
        const table = /** @type {any} */ (h('dm-table'));
        replace(resultEl,
          h('div', { class: 'dm-row-wrap' }, h('span', { class: 'dm-help dm-grow', text: out.note || '' }),
            out.markdown && ds ? ui.button({ label: t('plan.provisions.export'), icon: 'file-text', size: 'sm', title: t('plan.provisions.export.hint'), onClick: () => exportMarkdown(ds) }) : null,
            ui.button({ label: t('text.create.dataset'), icon: 'table', size: 'sm', disabled: !out.rows.length, onClick: () => createDataset(out) })),
          h('div', { class: 'dm-table-wrap' }, table));
        requestAnimationFrame(() => { if (table.isConnected) table.setData({ columns: out.columns.map((c) => ({ key: c.name, label: c.label || c.name, type: c.type })), rowCount: Math.min(out.rows.length, PREVIEW_ROWS), rowProvider: async (start, count) => out.rows.slice(start, start + count) }); });
      }
      async function exportMarkdown(ds) {
        const rows = await rowsOf(ds);
        const labels = { plan: t('plan.slag.detaljplan'), beteckning: t('plan.field.beteckning'), kommun: t('plan.field.kommun'), status: t('plan.field.status'), lagakraft: t('plan.field.lagakraft') };
        for (const typ of plan.OBJECT_TYPES) labels[typ] = t('plan.type.' + typ);
        files.download(new Blob([plan.provisionsMarkdown(ds.plan || {}, rows, labels)], { type: 'text/markdown;charset=utf-8' }), files.safeName(ds.name, 'md'));
      }
      async function createDataset(out) {
        const name = await ui.dialog.prompt(t('text.dataset.name'), { title: t('text.create.dataset'), value: out.name || t('plan.tool.' + s.tool) });
        if (!name) return;
        try {
          const meta = await datasets.create({ name, columns: out.columns.map((c) => ({ name: c.name, type: c.type, label: c.label || c.name })), rows: out.rows, description: out.note || '', source: { kind: 'derived', tool: 'plan:' + s.tool } });
          const msg = t('text.dataset.created', { name: meta.name, rows: i18n.formatNumber(meta.rowCount) });
          shell.log(msg, 'ok');
          ui.toast.show(msg, { kind: 'ok', action: { label: t('import.open.bearbeta'), onClick: () => { store.set({ selectedId: meta.id }); shell.activate('bearbeta'); } } });
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }
      function select(label, opts, value, onChange) {
        const el = /** @type {any} */ (h('dm-select', { label }));
        el.options = opts; el.value = value;
        el.addEventListener('change', () => onChange(el.value));
        return el;
      }

      function inspector() {
        const ds = selected();
        const items = [h('h4', { text: t('plan.tool.' + s.tool) }), h('p', { class: 'dm-help', text: t('plan.tool.about.' + s.tool) })];
        if (usable(ds)) items.push(h('p', { class: 'dm-help', text: t('plan.dataset.about', { name: ds.name, n: i18n.formatNumber(ds.rowCount || 0), slag: t('plan.slag.' + slagOf(ds)) }) }));
        items.push(h('p', { class: 'dm-help dm-xs', text: t('plan.catalog.source') }));
        return items;
      }
      function datasetChanged() { if (fieldsEl) { renderFields(); renderResult(); } }
      function destroy() { seq++; fieldsEl = null; resultEl = null; }
      return { center, inspector, datasetChanged, destroy, state: s };
    }
    return { create, TOOLS };
  });
})();
