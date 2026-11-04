// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Bilder tab in Analysera, shown when the selected dataset is an image collection: an overview (by type, camera,
 * year or month; dates, positions, sizes) and near-duplicate detection from the stored thumbnails
 * (analysis/images.js, 8×8 average hash). Breakdowns and duplicate groups can become datasets.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/analysis/images-panel', ['ui/base', 'analysis/images', 'data/datasets', 'data/dataset-files'], (base, imageAnalysis, datasets, dsFiles) => {
    const { h, t, i18n, replace } = base;
    const TOOLS = ['overview', 'duplicates'];
    const BREAKDOWNS = ['type', 'camera', 'year', 'month'];
    const DISTANCES = [0, 2, 5, 8, 12];
    const MAX_ROWS = 50000;
    const pause = () => new Promise((resolve) => setTimeout(resolve, 0));

    /**
     * @param {any} ctx shell context (ui, services, store, shell)
     * @param {{rerenderRight?: () => void}} [options]
     */
    function create(ctx, options = {}) {
      const { ui, store, shell } = ctx;
      const s = { tool: 'overview', breakdown: 'camera', distance: 5 };
      let rows = []; let rowsFor = null; let columns = []; let idx = null;
      /** Hashes of the thumbnails, computed on request and kept per dataset version. */
      let hashes = null; let hashesFor = null; let hashing = false;
      let resultEl = null; let fieldsEl = null; let seq = 0; let timer = 0;

      const selected = () => { const st = store.get(); return st.datasets.find((d) => d.id === st.selectedId) || null; };
      const usable = (ds) => !!ds && ds.kind === 'images';

      async function loadRows() {
        const ds = selected();
        if (!usable(ds)) { rows = []; rowsFor = null; return null; }
        const key = ds.id + ':' + ds.updatedAt;
        if (rowsFor === key) return ds;
        columns = await datasets.columns(ds.id);
        idx = imageAnalysis.indexes(columns);
        rows = await datasets.query(ds.id, { limit: MAX_ROWS });
        rowsFor = key;
        if (hashesFor && !hashesFor.startsWith(ds.id + ':')) { hashes = null; hashesFor = null; }
        return ds;
      }
      function select(label, opts, value, onChange) {
        const el = /** @type {any} */ (h('dm-select', { label }));
        el.options = opts; el.value = value;
        el.addEventListener('change', () => onChange(el.value));
        return el;
      }

      function center() {
        const head = h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon('images', 20), t('images.title')));
        if (!usable(selected())) return { head, body: [h('dm-empty-state', { icon: 'image', heading: t('images.no.dataset'), text: t('images.intro') })] };
        const tabs = /** @type {any} */ (h('dm-tabs'));
        tabs.tabs = TOOLS.map((id) => ({ id, label: t('images.tool.' + id) }));
        tabs.active = s.tool;
        tabs.addEventListener('dm-change', (e) => { s.tool = /** @type {any} */ (e).detail.id; renderFields(); schedule(0); if (options.rerenderRight) options.rerenderRight(); });
        fieldsEl = h('div', { class: 'dm-stack-sm' });
        resultEl = h('div', { class: 'dm-tool-result dm-center-fill' });
        renderFields(); schedule(0);
        return { head, body: [tabs, fieldsEl, resultEl] };
      }
      function renderFields() {
        if (!fieldsEl) return;
        const parts = [];
        if (s.tool === 'overview') parts.push(select(t('images.breakdown'), BREAKDOWNS.map((b) => ({ value: b, label: t('images.by.' + b) })), s.breakdown, (v) => { s.breakdown = v; schedule(0); }));
        else {
          parts.push(select(t('images.distance'), DISTANCES.map((d) => ({ value: String(d), label: d === 0 ? t('images.distance.exact') : t('images.distance.bits', { n: d }) })), String(s.distance), (v) => { s.distance = Number(v); schedule(0); }));
          parts.push(ui.button({ label: t('images.find'), icon: 'search', variant: 'primary', loading: hashing, disabled: hashing, title: t('images.find.hint'), onClick: () => findDuplicates() }));
        }
        replace(fieldsEl, h('p', { class: 'dm-help', text: t('images.hint.' + s.tool) }), h('div', { class: 'dm-tool-fields' }, parts));
      }

      function schedule(delay = 0) { clearTimeout(timer); timer = setTimeout(() => run(), delay); }
      async function run() {
        if (!resultEl) return;
        const my = ++seq;
        try {
          const ds = await loadRows();
          if (my !== seq || !resultEl) return;
          if (!ds) { replace(resultEl, h('dm-empty-state', { icon: 'image', heading: t('images.no.dataset'), text: t('images.intro') })); return; }
          if (s.tool === 'overview') renderOverview(ds); else renderDuplicates(ds);
        } catch (err) { if (my === seq && resultEl) replace(resultEl, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) })); }
      }

      function renderOverview(ds) {
        const sum = imageAnalysis.summarize(rows, idx);
        const kv = /** @type {any} */ (h('dm-kv'));
        kv.items = [
          { label: t('images.count'), value: i18n.formatNumber(sum.count) },
          { label: t('common.size'), value: i18n.formatBytes(sum.bytes) },
          { label: t('images.pixels'), value: t('images.megapixels', { n: i18n.formatNumber(Math.round(sum.pixels / 1e5) / 10) }) },
          { label: t('images.with.date'), value: i18n.formatNumber(sum.withDate) },
          { label: t('images.with.camera'), value: i18n.formatNumber(sum.withCamera) },
          { label: t('images.with.position'), value: i18n.formatNumber(sum.withPosition) },
          sum.first ? { label: t('images.period'), value: `${String(sum.first).slice(0, 10)} – ${String(sum.last).slice(0, 10)}` } : null,
        ].filter(Boolean);
        const list = s.breakdown === 'type' ? sum.byType : s.breakdown === 'camera' ? sum.byCamera : s.breakdown === 'year' ? sum.byYear : sum.byMonth;
        const out = { columns: [{ name: s.breakdown === 'type' ? 'typ' : s.breakdown === 'camera' ? 'kamera' : s.breakdown === 'year' ? 'ar' : 'manad', type: 'text', label: t('images.by.' + s.breakdown) }, { name: 'antal', type: 'integer', label: t('images.col.antal') }, { name: 'andel', type: 'number', label: t('images.col.andel') }], rows: list.map((e) => [String(e.value), e.count, Math.round(e.count / Math.max(1, sum.count) * 10000) / 10000]) };
        const table = /** @type {any} */ (h('dm-table'));
        replace(resultEl,
          h('div', { class: 'dm-card' }, kv),
          h('div', { class: 'dm-row' }, h('span', { class: 'dm-help dm-grow', text: t('images.breakdown.note', { n: i18n.formatNumber(list.length), what: t('images.by.' + s.breakdown) }) }),
            ui.button({ label: t('text.create.dataset'), icon: 'table', size: 'sm', disabled: !out.rows.length, onClick: () => createDataset(ds, out, t('images.dataset.default.' + s.breakdown, { name: ds.name }), 'images:' + s.breakdown) })),
          h('div', { class: 'dm-table-wrap' }, table));
        requestAnimationFrame(() => { if (table.isConnected) table.setData({ columns: out.columns.map((c) => ({ key: c.name, label: c.label, type: c.type })), rowCount: out.rows.length, rowProvider: async (start, count) => out.rows.slice(start, start + count) }); });
      }

      /** Hash every thumbnail (a few milliseconds each) with a pause every few pictures so the page stays responsive. */
      async function findDuplicates() {
        const ds = await loadRows();
        if (!ds || hashing) return;
        hashing = true; renderFields();
        const my = ++seq;
        const progress = /** @type {any} */ (h('dm-progress', { value: '0', label: t('images.hashing') }));
        const note = h('p', { class: 'dm-help', text: t('images.hashing') });
        if (resultEl) replace(resultEl, progress, note);
        const items = [];
        try {
          for (let i = 0; i < rows.length; i++) {
            const name = String(rows[i][idx.fileIndex] || '');
            try {
              const file = await dsFiles.read(ds.id, name, 'thumb');
              if (file) items.push({ name, hash: await imageAnalysis.aHash(new Blob([file.bytes], { type: file.type })) });
            } catch (_err) { /* a picture without a thumbnail is skipped */ }
            if (i % 8 === 7) { progress.setAttribute('value', String(Math.round((i + 1) / rows.length * 100))); note.textContent = t('images.hashing.progress', { done: i18n.formatNumber(i + 1), total: i18n.formatNumber(rows.length) }); await pause(); }
            if (my !== seq && !resultEl) return;
          }
          hashes = items; hashesFor = ds.id + ':' + ds.updatedAt;
        } finally { hashing = false; renderFields(); }
        if (resultEl) renderDuplicates(ds);
      }
      async function renderDuplicates(ds) {
        if (!hashes || hashesFor !== ds.id + ':' + ds.updatedAt) {
          if (hashing) return;
          replace(resultEl, h('p', { class: 'dm-help', text: hashes ? t('images.dup.stale') : t('images.dup.start', { n: i18n.formatNumber(rows.length) }) }));
          return;
        }
        const groups = imageAnalysis.groupDuplicates(hashes, s.distance);
        const pictures = groups.reduce((n, g) => n + g.length, 0);
        const out = { columns: [{ name: 'fil', type: 'text', label: t('images.col.fil') }, { name: 'grupp', type: 'integer', label: t('images.col.grupp') }, { name: 'avstand', type: 'integer', label: t('images.col.avstand') }, { name: 'hash', type: 'text', label: t('images.col.hash') }], rows: groups.flatMap((g, gi) => g.map((it) => [it.name, gi + 1, it.distance, it.hash])) };
        const nodes = [];
        for (const [gi, g] of groups.slice(0, 100).entries()) {
          const pics = [];
          for (const it of g) {
            const url = await dsFiles.url(ds.id, it.name, 'thumb').catch(() => null);
            pics.push(h('div', { class: 'dm-dup-item' }, url ? h('img', { src: url, alt: it.name, loading: 'lazy' }) : ui.icon('image', 24), h('span', { class: 'dm-truncate', text: it.name, title: it.name }), h('span', { class: 'dm-muted', text: it.distance ? t('images.distance.bits', { n: it.distance }) : t('images.distance.exact') })));
          }
          nodes.push(h('div', { class: 'dm-dup-group', role: 'group', 'aria-label': t('images.dup.group', { n: gi + 1 }) }, pics));
        }
        if (!resultEl) return;
        replace(resultEl,
          h('div', { class: 'dm-row' }, h('span', { class: 'dm-help dm-grow', text: t('images.dup.note', { groups: i18n.formatNumber(groups.length), pictures: i18n.formatNumber(pictures), total: i18n.formatNumber(hashes.length) }) }),
            ui.button({ label: t('text.create.dataset'), icon: 'table', size: 'sm', disabled: !out.rows.length, onClick: () => createDataset(ds, out, t('images.dataset.default.duplicates', { name: ds.name }), 'images:duplicates') })),
          groups.length ? h('div', { class: 'dm-stack-sm' }, nodes, groups.length > 100 ? h('p', { class: 'dm-help', text: t('images.dup.more', { n: groups.length - 100 }) }) : null) : h('p', { class: 'dm-help', text: t('images.dup.none') }));
      }

      async function createDataset(ds, out, defaultName, tool) {
        const name = await ui.dialog.prompt(t('text.dataset.name'), { title: t('text.create.dataset'), value: defaultName });
        if (!name) return;
        try {
          const meta = await datasets.create({ name, columns: out.columns.map((c) => ({ name: c.name, type: c.type, label: c.label })), rows: out.rows, description: t('images.dataset.description', { name: ds.name }), source: { kind: 'derived', from: ds.id, tool, settings: { breakdown: s.breakdown, distance: s.distance } } });
          const msg = t('text.dataset.created', { name: meta.name, rows: i18n.formatNumber(meta.rowCount) });
          shell.log(msg, 'ok'); ui.toast.show(msg, { kind: 'ok' });
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }

      function inspector() {
        const ds = selected();
        const items = [h('h4', { text: t('images.tool.' + s.tool) }), h('p', { class: 'dm-help', text: t('images.about.' + s.tool) })];
        if (s.tool === 'duplicates') items.push(h('p', { class: 'dm-help', text: t('images.about.distance') }));
        if (usable(ds)) items.push(h('h4', { text: t('text.dataset') }), h('p', { class: 'dm-help', text: t('images.dataset.about', { name: ds.name, n: i18n.formatNumber(ds.rowCount || 0) }) }));
        return items;
      }
      function datasetChanged() { rowsFor = null; if (resultEl) schedule(0); }
      function destroy() { clearTimeout(timer); seq++; resultEl = null; fieldsEl = null; }
      return { center, inspector, datasetChanged, destroy, state: s };
    }
    return { create, TOOLS, BREAKDOWNS, DISTANCES };
  });
})();
