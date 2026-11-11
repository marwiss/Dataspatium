// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Mode "Kontrollera": data tried against requirements. A table is tried against simple rules, every column's type and
 * number of empty values and the number of duplicate rows, counted in the dataset's SQL engine: at once for a small table,
 * on the button for a large one. An IFC model shows the checks that exist elsewhere, reused as they are: the card Validera
 * modellen (the server's check of the file, the schema, IDS and clash detection with their latest results; the checks
 * themselves run in Analysera under Mängder) and the panel Jämför versioner, and the card Topologi (the rooms the walls
 * enclose per storey, open wall ends and the external walls per compass direction, on the button). Other kinds have no checks
 * yet. The inspector shows the chosen finding.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/modes/kontrollera', ['ui/base', 'data/kinds', 'ui/kinds/insight-cards', 'ui/bearbeta/model-compare'], (base, kinds, cards, compareModule) => {
    const { h, t, i18n, replace } = base;
    /** A table with fewer rows than this is checked as soon as it is chosen; a larger one waits for the button. */
    const AUTO_ROWS = 10000;
    const ICON = 'list-checks';
    /** The compass sectors the topology names, in the order of kontrollera.topology.facings. */
    const FACINGS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

    /**
     * The rules a table is tried against, counted in its SQL engine: the empty values of every column (null, or text that
     * is blank) and the rows that are copies of another row (every column equal).
     * @param {any} datasets the datasets service
     * @param {string} id the dataset
     * @returns {Promise<{rows: number, duplicates: number, columns: Array<{name: string, label: string, type: string, empty: number}>}>}
     */
    async function checkTable(datasets, id) {
      const cols = await datasets.columns(id);
      const engine = (await datasets.ensureOpen(id)).engine;
      const q = (name) => '"' + String(name).replace(/"/g, '""') + '"';
      const empty = (c) => `sum(case when ${q(c.name)} is null or trim(cast(${q(c.name)} as text)) = '' then 1 else 0 end)`;
      const res = await engine.exec(`select count(*)${cols.map((c) => ', ' + empty(c)).join('')} from data`);
      const row = (res[0] && res[0].values[0]) || [];
      const rows = Number(row[0]) || 0;
      let distinct = rows;
      if (cols.length) {
        const d = await engine.exec(`select count(*) from (select distinct ${cols.map((c) => q(c.name)).join(', ')} from data)`);
        distinct = Number(d[0] && d[0].values[0] && d[0].values[0][0]) || 0;
      }
      return { rows, duplicates: rows - distinct, columns: cols.map((c, i) => ({ name: c.name, label: c.label || c.name, type: c.type, empty: Number(row[i + 1]) || 0 })) };
    }

    function createMode(ctx) {
      const { ui, services, store, shell } = ctx;
      let slots = null; let unsubscribe = null; let currentId = null; let lastUpdated = null;
      /** The result of the table check for the current dataset while it is unchanged, and the error of the last run. */
      let result = null; let error = '';
      /** The datasets whose check is running now. */
      const running = new Set();
      /** The chosen finding: a column name, or null for the whole table. */
      let chosen = null;
      /** The panel Jämför versioner, reused from Bearbeta's model view. */
      let compare = null;

      function activate(s) {
        slots = s;
        unsubscribe = store.subscribe((state, changed) => { if (changed.includes('datasets') || changed.includes('selectedId')) render(); });
        render();
      }
      function deactivate() { slots = null; currentId = null; result = null; error = ''; chosen = null; if (unsubscribe) { unsubscribe(); unsubscribe = null; } dropCompare(); }
      function dropCompare() { if (compare) { compare.destroy(); compare = null; } }
      function current() { const state = store.get(); return state.datasets.find((d) => d.id === state.selectedId) || null; }
      const typeLabel = (type) => (i18n.has('type.' + type) ? t('type.' + type) : String(type || ''));

      function render() {
        if (!slots) return;
        const state = store.get();
        ui.datasetList.render(slots.left, { datasets: state.datasets, selectedId: state.selectedId, onSelect: (id) => store.set({ selectedId: id }) });
        const ds = current();
        if (!ds) {
          currentId = null; result = null; error = ''; chosen = null; dropCompare();
          replace(slots.center, h('dm-empty-state', { icon: ICON, heading: t('kontrollera.empty'), text: state.datasets.length ? t('shell.select.dataset') : t('shell.no.datasets.hint') },
            state.datasets.length ? null : ui.button({ label: t('mode.inhamta'), icon: 'download', variant: 'primary', onClick: () => shell.activate('inhamta') })));
          replace(slots.right, h('p', { class: 'dm-help', text: t('kontrollera.empty.hint') }));
          return;
        }
        // The work area is drawn anew for another dataset, or when the dataset's content has changed; otherwise it stays.
        if (currentId === ds.id && ds.updatedAt === lastUpdated) return;
        currentId = ds.id; lastUpdated = ds.updatedAt; result = null; error = ''; chosen = null; dropCompare();
        renderMain(ds);
      }

      const head = (ds, ...actions) => h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon(ICON, 20), ds.name), h('div', { class: 'dm-toolbar' }, ...actions));

      /** The checks of the dataset's kind: rules for a table, the model's cards for an IFC model, nothing yet for the rest. */
      function renderMain(ds) {
        const profile = kinds.of(ds);
        if (profile === kinds.PROFILES.table) { renderTable(ds); return; }
        if (profile === kinds.PROFILES.model && !kinds.isDxf(ds)) { renderModel(ds); return; }
        replace(slots.center, head(ds), h('dm-empty-state', { icon: ICON, heading: t('kontrollera.none'), text: t('kontrollera.none.hint'), 'data-kontrollera-none': '' }));
        replace(slots.right, h('p', { class: 'dm-help', text: t('kontrollera.none.hint') }));
      }

      // ---- tables ---------------------------------------------------------------------------------------------
      function renderTable(ds) {
        if (!slots) return;
        const large = (ds.rowCount || 0) >= AUTO_ROWS;
        const busy = running.has(ds.id);
        const runBtn = ui.button({ label: t('kontrollera.run'), icon: 'play', variant: 'primary', title: t('kontrollera.run.hint'), loading: busy, 'data-kontrollera-run': '', onClick: () => runCheck(ds) });
        const parts = [head(ds, runBtn), h('p', { class: 'dm-help', text: t('kontrollera.table.help') })];
        if (busy) parts.push(h('dm-progress', { indeterminate: true, label: t('kontrollera.running') }));
        else if (error) parts.push(h('p', { class: 'dm-error dm-small', text: error }));
        else if (!result) parts.push(h('p', { class: 'dm-help', 'data-kontrollera-waiting': '', text: large ? t('kontrollera.large', { n: i18n.formatNumber(ds.rowCount || 0) }) : t('kontrollera.running') }));
        else parts.push(summaryCard(), rulesTable(ds));
        replace(slots.center, ...parts);
        renderInspector(ds);
        // A small table is checked at once; a large one only on the button, and none again after an error.
        if (!result && !busy && !error && !large) runCheck(ds);
      }

      async function runCheck(ds) {
        if (running.has(ds.id)) return;
        running.add(ds.id);
        const stamp = ds.updatedAt;
        result = null; error = ''; chosen = null;
        renderTable(ds);
        let r = null; let failed = '';
        try { r = await checkTable(services.datasets, ds.id); } catch (err) { failed = String((err && err.message) || err); } finally { running.delete(ds.id); }
        if (!slots || currentId !== ds.id) return;
        const now = current() || ds;
        // The content changed while the check ran: the result is stale, and a small table is checked again.
        if (lastUpdated !== stamp) { renderTable(now); return; }
        if (failed) {
          // The dataset can be removed while the check runs; only other errors are shown, and only while it is still chosen.
          if (!(await services.datasets.get(ds.id).catch(() => null)) || !slots || currentId !== ds.id) return;
          error = failed;
        } else {
          result = r;
          shell.log(t('kontrollera.done', { name: ds.name, empty: i18n.formatNumber(r.columns.reduce((s, c) => s + c.empty, 0)), duplicates: i18n.formatNumber(r.duplicates) }), 'ok');
        }
        renderTable(now);
      }

      const findingsBadge = (n) => h('dm-badge', { text: n ? t('kontrollera.findings', { n: i18n.formatNumber(n) }) : t('kontrollera.findings.none'), kind: n ? 'warn' : 'ok' });

      /** The whole table: rows, empty values in all and duplicates. */
      function summaryCard() {
        const r = result;
        const empty = r.columns.reduce((s, c) => s + c.empty, 0);
        const kv = /** @type {any} */ (h('dm-kv'));
        kv.items = [
          { label: t('kontrollera.rows'), value: i18n.formatNumber(r.rows) },
          { label: t('kontrollera.col.empty'), value: i18n.formatNumber(empty) },
          { label: t('kontrollera.duplicates'), value: i18n.formatNumber(r.duplicates) },
        ];
        return h('div', { class: 'dm-card dm-stack-sm', 'data-kontrollera-summary': '', 'data-kontrollera-rows': String(r.rows), 'data-kontrollera-empty': String(empty), 'data-kontrollera-duplicates': String(r.duplicates) },
          h('div', { class: 'dm-row' }, h('strong', { class: 'dm-grow', text: t('kontrollera.summary') }), findingsBadge(empty + r.duplicates)),
          kv);
      }

      /** One row per column: its type and its empty values; a chosen row shows the finding in the inspector. */
      function rulesTable(ds) {
        const r = result;
        const table = /** @type {any} */ (h('dm-table', { 'data-kontrollera-rules': '', 'aria-label': t('kontrollera.rules') }));
        table.setData({
          columns: [
            { key: 'column', label: t('kontrollera.col.column'), type: 'text' },
            { key: 'type', label: t('kontrollera.col.type'), type: 'text' },
            { key: 'empty', label: t('kontrollera.col.empty'), type: 'integer' },
          ],
          rowCount: r.columns.length,
          rowProvider: async (start, count) => r.columns.slice(start, start + count).map((c) => [c.label, typeLabel(c.type), c.empty]),
        });
        table.addEventListener('dm-row', (e) => { const c = r.columns[/** @type {any} */ (e).detail.index]; chosen = c ? c.name : null; renderInspector(ds); });
        return h('div', { class: 'dm-table-wrap dm-center-fill' }, table);
      }

      /** The chosen finding: a column's empty values, or the table's duplicates when no row is chosen. */
      function renderInspector(ds) {
        if (!slots) return;
        if (!result) { replace(slots.right, h('p', { class: 'dm-help', text: t('kontrollera.inspector.hint') })); return; }
        const r = result;
        const col = chosen ? r.columns.find((c) => c.name === chosen) : null;
        const share = (n) => (r.rows ? i18n.formatNumber((100 * n) / r.rows, { maximumFractionDigits: 1 }) + ' %' : '–');
        const kv = /** @type {any} */ (h('dm-kv'));
        kv.items = col ? [
          { label: t('kontrollera.rule'), value: t('kontrollera.rule.empty') },
          { label: t('kontrollera.col.column'), value: col.name },
          { label: t('kontrollera.col.type'), value: typeLabel(col.type) },
          { label: t('kontrollera.col.empty'), value: i18n.formatNumber(col.empty) },
          { label: t('kontrollera.share'), value: share(col.empty) },
        ] : [
          { label: t('kontrollera.rule'), value: t('kontrollera.rule.duplicates') },
          { label: t('kontrollera.rows'), value: i18n.formatNumber(r.rows) },
          { label: t('kontrollera.duplicates'), value: i18n.formatNumber(r.duplicates) },
          { label: t('kontrollera.share'), value: share(r.duplicates) },
        ];
        replace(slots.right, h('div', { class: 'dm-stack-sm', 'data-kontrollera-finding': col ? col.name : '' },
          h('h4', { text: col ? col.label : ds.name }),
          h('div', null, findingsBadge(col ? col.empty : r.duplicates)),
          kv,
          h('p', { class: 'dm-help dm-small', text: t(col ? 'kontrollera.rule.empty.help' : 'kontrollera.rule.duplicates.help') }),
          col ? null : h('p', { class: 'dm-help dm-small', text: t('kontrollera.select') }),
          h('div', null, ui.button({ label: t('import.open.bearbeta'), icon: 'wand-sparkles', size: 'sm', title: t('kontrollera.open.bearbeta.hint'), onClick: () => { store.set({ selectedId: ds.id }); shell.activate('bearbeta'); } }))));
      }

      // ---- IFC models ------------------------------------------------------------------------------------------
      /** The checks that exist for a model, reused: the card Validera modellen (Hantera) and the panel Jämför versioner (Bearbeta). */
      function renderModel(ds) {
        dropCompare();
        compare = compareModule.create(ctx, ds, {});
        const openBtn = ui.button({ label: t('import.open.bearbeta'), icon: 'box', title: t('kontrollera.model.open.hint'), onClick: () => { store.set({ selectedId: ds.id }); shell.activate('bearbeta'); } });
        replace(slots.center, head(ds, openBtn), h('p', { class: 'dm-help', text: t('kontrollera.model.help') }),
          h('div', { class: 'dm-stack', 'data-kontrollera-model': '' }, cards.validationCard(ctx, ds), compare.el, topologyCard(ds)));
        replace(slots.right, h('p', { class: 'dm-help', text: t('kontrollera.model.inspector') }));
      }

      /**
       * The card Topologi (decision F46 a): per storey with walls the rooms they enclose, closed or open, the open wall ends and the
       * external walls per compass direction, read by the wheel (data/ifc-ops.topologyOf). The button is the person's action, so
       * it may start Python, as the preview of Ändra med AI does.
       */
      function topologyCard(ds) {
        const el = h('div', { class: 'dm-card dm-stack-sm', 'data-card': 'topology' });
        const state = { busy: false, error: '', storeys: /** @type {any[]|null} */ (null) };
        const names = t('kontrollera.topology.facings').split(',');
        const num = (v) => i18n.formatNumber(Number(v) || 0, { maximumFractionDigits: 2 });
        async function run() {
          if (state.busy) return;
          state.busy = true; state.error = ''; state.storeys = null; draw();
          try { state.storeys = await D.require('data/ifc-ops').topologyOf(ds.id); } catch (err) { state.error = String((err && err.message) || err); }
          state.busy = false; draw();
        }
        function storey(s) {
          const counts = new Map();
          for (const w of s.external || []) counts.set(w.facing, (counts.get(w.facing) || 0) + 1);
          const ends = s.dangles || [];
          const kv = /** @type {any} */ (h('dm-kv'));
          kv.items = [
            { label: t('kontrollera.topology.walls'), value: num(s.walls) + (s.unread ? ' ' + t('kontrollera.topology.unread', { n: num(s.unread) }) : '') },
            { label: t('kontrollera.topology.rooms'), value: num((s.rooms || []).length) },
            { label: t('kontrollera.topology.dangles'), value: [num(ends.length)].concat(ends.slice(0, 5).map((p) => `(${num(p[0])}; ${num(p[1])})`)).join(' ') + (ends.length > 5 ? ' …' : '') },
            { label: t('kontrollera.topology.external'), value: FACINGS.filter((f) => counts.has(f)).map((f) => `${names[FACINGS.indexOf(f)] || f} ${num(counts.get(f))}`).join(' · ') || '–' },
          ];
          return h('div', { class: 'dm-stack-xs', 'data-topology-storey': String(s.storey || ''), 'data-topology-closed': String(!!s.closed), 'data-topology-rooms': String((s.rooms || []).length), 'data-topology-dangles': String(ends.length) },
            h('div', { class: 'dm-row' }, h('strong', { class: 'dm-grow', text: String(s.storey || '') }), h('dm-badge', { text: t(s.closed ? 'kontrollera.topology.closed' : 'kontrollera.topology.open'), kind: s.closed ? 'ok' : 'warn' })),
            kv);
        }
        function draw() {
          const shown = (state.storeys || []).filter((s) => s && (s.walls || s.unread));
          replace(el,
            h('h3', { text: t('kontrollera.topology') }),
            h('p', { class: 'dm-help', text: t('kontrollera.topology.help') }),
            h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('kontrollera.topology.run'), icon: 'scan-line', size: 'sm', loading: state.busy, title: t('kontrollera.topology.run.hint'), 'data-topology-run': '', onClick: run })),
            state.error ? h('p', { class: 'dm-error dm-small', 'data-topology-error': '', text: state.error }) : null,
            state.storeys && !shown.length ? h('p', { class: 'dm-help dm-small', 'data-topology-none': '', text: t('kontrollera.topology.none') }) : null,
            shown.map(storey),
            shown.length ? h('p', { class: 'dm-help dm-xs', text: t('kontrollera.topology.north.' + (['map', 'true_north'].includes(shown[0].north) ? shown[0].north : 'model')) }) : null);
        }
        draw();
        return el;
      }

      return { id: 'kontrollera', activate, deactivate };
    }
    return { createMode, checkTable, AUTO_ROWS };
  });
})();
