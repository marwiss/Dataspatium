// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The tool Klimatdeklaration among the model tools in Analysera (ui/analysis/model-panel): a preliminary climate declaration from
 * the model. It shows the sums per Boverket category or per layer of the building, one row per element and material, the
 * materials with the resource of Boverket's climate database each is counted with, and the elements to settle: those the rules
 * cannot decide and those they decide provisionally, in groups the person settles at once. Categories, layers and quantities
 * need no network. The database is fetched only on its button (consent for the purpose api) and kept in the browser; IsExternal
 * is derived from the building's topology only on its button (the app's Python, started then). Choices of resource per material
 * and settlements per element are kept for every model. The logic lives in analysis/climate and api/klimatdatabas; every table
 * can be saved as a dataset through the model panel.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/analysis/climate-panel', ['ui/base', 'ui/basic', 'analysis/climate', 'api/klimatdatabas'], (base, basic, climate, klimatdb) => {
    const { h, t, i18n, replace } = base;
    const VIEWS = ['summary', 'layers', 'elements', 'materials', 'settle'];
    const SETTLE_TO = ['grund', 'barande', 'skarm', 'inner', 'ingar_inte'];
    const OPENINGS = /^IFC(WALL|WALLSTANDARDCASE|WALLELEMENTEDCASE|DOOR|DOORSTANDARDCASE|WINDOW|WINDOWSTANDARDCASE)$/;

    /** @param {any} ctx shell context @param {{refresh?: () => void}} [options] refresh draws the fields and the result again */
    function create(ctx, options = {}) {
      const { ui, shell } = ctx;
      const s = { view: 'summary', value: 'conservative', busy: '' };
      /** The model's facts, per dataset and version: {key, promise}. @type {{key: string, promise: Promise<any>}|null} */ let gathered = null;
      /** IsExternal from the topology, per dataset and version. @type {{key: string, map: Map<number, boolean>}|null} */ let topo = null;
      /** The kept database: undefined until read, null when there is none. @type {any} */ let db;
      /** @type {Record<string, string>|null} */ let choices = null;
      /** @type {Record<string, string>|null} */ let settled = null;
      const refresh = () => { if (options.refresh) options.refresh(); };
      const number = (v, digits = 1) => i18n.formatNumber(v, { maximumFractionDigits: digits });
      const keyOf = (ds) => ds.id + ':' + (ds.updatedAt || '');

      async function load() {
        if (db === undefined) db = await klimatdb.cached();
        if (!choices) choices = await climate.choices();
        if (!settled) settled = await climate.settled();
      }
      /** The model's facts, read once per version: the fields and the result wait for the same reading. */
      function dataOf(ds) {
        const key = keyOf(ds);
        if (!gathered || gathered.key !== key) {
          const promise = climate.gather(ds.id);
          gathered = { key, promise };
          promise.catch(() => { if (gathered && gathered.promise === promise) gathered = null; });
        }
        return gathered.promise;
      }
      const derivedFor = (ds) => (topo && topo.key === keyOf(ds) ? topo.map : null);
      const sourceText = () => (db ? t('climate.db.source', { version: db.version, date: String(db.fetchedAt || '').slice(0, 10) }) : t('climate.db.none'));
      /** Walls, doors and windows whose IsExternal the file does not give. */
      const missingExternal = (data) => data.elements.filter((e) => e.external === null && OPENINGS.test(String(e.cls || '').toUpperCase())).length;

      /** The choices above the result: what to show, which A1–A3 value, the database and IsExternal from the topology. */
      async function fields(ds) {
        await load();
        const data = await dataOf(ds).catch(() => null);
        const missing = data && data.hasFile ? missingExternal(data) : 0;
        const derived = derivedFor(ds);
        return [
          h('div', { class: 'dm-row-wrap' },
            basic.select(t('climate.view'), VIEWS.map((v) => ({ value: v, label: t('climate.view.' + v) })), s.view, (v) => { s.view = v; refresh(); }, { 'data-climate-view': '' }),
            basic.select(t('climate.value'), ['conservative', 'typical'].map((v) => ({ value: v, label: t('climate.value.' + v) })), s.value, (v) => { s.value = v; refresh(); }, { 'data-climate-value': '', title: t('climate.value.hint') })),
          h('div', { class: 'dm-row-wrap' },
            h('span', { class: 'dm-help dm-grow', 'data-climate-db': '', text: sourceText() }),
            ui.button({ label: t(db ? 'climate.db.refetch' : 'climate.db.fetch'), icon: 'download', size: 'sm', variant: db ? 'ghost' : 'primary', loading: s.busy === 'db', title: t(db ? 'climate.db.refetch.hint' : 'climate.db.fetch.hint'), 'data-climate-fetch': '', onClick: () => fetchDb() }),
            missing && !derived ? ui.button({ label: t('climate.topology'), icon: 'scan-line', size: 'sm', loading: s.busy === 'topology', title: t('climate.topology.hint', { n: i18n.formatNumber(missing) }), 'data-climate-topology': '', onClick: () => deriveExternal(ds) }) : null),
        ];
      }

      /** Fetch the database: only here, on the button, after consent. */
      async function fetchDb() {
        if (s.busy) return;
        s.busy = 'db'; refresh();
        try {
          db = await klimatdb.fetchLatest();
          const msg = t('climate.db.fetched', { version: db.version, n: i18n.formatNumber(db.resources.length) });
          shell.log(msg, 'ok'); ui.toast.show(msg, { kind: 'ok' });
        } catch (err) {
          const msg = String((err && err.message) || err);
          shell.log(msg, 'error'); ui.toast.show(msg, { kind: 'error' });
        }
        s.busy = ''; refresh();
      }
      /** IsExternal from the building's topology: the app's Python reads the walls (it starts now if it is not running). */
      async function deriveExternal(ds) {
        if (s.busy) return;
        s.busy = 'topology'; refresh();
        try {
          const map = climate.externalFromTopology(await D.require('data/ifc-ops').topologyOf(ds.id));
          topo = { key: keyOf(ds), map };
          shell.log(t('climate.topology.done', { n: i18n.formatNumber(map.size) }), 'ok');
        } catch (err) {
          const msg = String((err && err.message) || err).trim().split('\n').pop() || '';
          shell.log(msg, 'error'); ui.toast.show(msg, { kind: 'error' });
        }
        s.busy = ''; refresh();
      }

      /** What the result rests on, in the person's words: what is uncertain, derived, left out or only proposed, and the source. */
      function notes(data, decided, rows, extra) {
        const out = [extra];
        if (!data.hasFile) out.push(t('climate.note.nofile'));
        if (data.containers) out.push(t('climate.note.containers', { n: i18n.formatNumber(data.containers) }));
        const derived = decided.elements.filter((e) => e.externalFrom).length;
        if (derived) out.push(t('climate.note.derived', { n: i18n.formatNumber(derived) }));
        const unsure = decided.elements.filter((e) => e.uncertain).length;
        const open = decided.elements.filter((e) => e.category === 'oklar').length;
        if (unsure || open) out.push(t('climate.note.settle', { uncertain: i18n.formatNumber(unsure), undecided: i18n.formatNumber(open) }));
        const missing = rows.filter((r) => !r.basis).length;
        if (missing) out.push(t('climate.note.missing', { n: i18n.formatNumber(missing) }));
        if (db) {
          const proposed = new Set(rows.filter((r) => r.resource && !r.chosen).map((r) => r.key)).size;
          if (proposed) out.push(t('climate.note.proposals', { n: i18n.formatNumber(proposed) }));
          out.push(sourceText());
        } else out.push(t('climate.note.nodb'));
        return out.filter(Boolean).join(' ');
      }

      /**
       * Draw the chosen view into the result area. @param {any} ds @param {HTMLElement} resultEl
       * @param {{isCurrent: () => boolean, showTable: (out: any) => void, createDataset: (out: any) => void}} hooks the model panel's table and dataset
       */
      async function run(ds, resultEl, hooks) {
        replace(resultEl, h('dm-progress', { indeterminate: true, label: t('climate.loading') }));
        let data;
        try { await load(); data = await dataOf(ds); } catch (err) {
          if (!hooks.isCurrent()) return;
          const msg = String((err && err.message) || err);
          replace(resultEl, h('p', { class: 'dm-error dm-small', text: msg }));
          shell.log(msg, 'error');
          return;
        }
        if (!hooks.isCurrent()) return;
        const decided = climate.decide(data, { derived: derivedFor(ds), settled });
        const rows = climate.compute(decided.posts, { db, choices: choices || {}, value: /** @type {any} */ (s.value) });
        if (s.view === 'materials') { materials(resultEl, data, decided, rows); return; }
        if (s.view === 'settle') { settle(ds, resultEl, decided, hooks); return; }
        let out;
        if (s.view === 'summary' || s.view === 'layers') out = Object.assign(climate.summaryTable(rows, s.view === 'layers' ? 'layer' : 'category'), { note: notes(data, decided, rows, t('climate.note.' + s.view)) });
        else out = Object.assign(climate.elementTable(rows), { note: notes(data, decided, rows, t('climate.note.elements', { n: i18n.formatNumber(rows.length) })) });
        out.name = `${ds.name}: ${t('climate.view.' + s.view)}`;
        hooks.showTable(out);
        const head = resultEl.firstElementChild;
        if (head) head.setAttribute('data-climate-result', s.view);
      }

      /** The materials, each with its quantity and a choice of resource: the proposals first, then every resource that fits. */
      function materials(resultEl, data, decided, rows) {
        const list = climate.materialsOf(decided.posts);
        const resources = db ? db.resources : [];
        const picked = climate.resolve(list, db, choices || {});
        const amount = (m) => (m.kinds.includes('volume') ? number(m.volume, 2) + ' m³' : m.kinds.includes('area') ? number(m.area, 1) + ' m²' : m.kinds.includes('mass') ? number(m.mass, 0) + ' kg' : t('climate.source.none'));
        const lines = list.map((m) => {
          const pick = picked.get(m.key) || { resource: null, chosen: false };
          const text = h('span', { class: 'dm-grow', text: [m.label, m.category, t('climate.material.elements', { n: i18n.formatNumber(m.elements) }), amount(m)].filter(Boolean).join(' · ') });
          if (!db) return h('div', { class: 'dm-row-wrap', 'data-climate-material-row': m.key }, text);
          const proposals = climate.suggest(m.name, resources, m.kinds, 5, m.category);
          const ids = new Set(proposals.map((r) => r.id));
          const opts = [{ value: '', label: t('climate.resource.none') }]
            .concat(proposals.map((r) => ({ value: r.id, label: r.name, group: t('climate.resource.proposals') })))
            .concat(resources.filter((r) => !ids.has(r.id) && climate.compatible(r, m.kinds)).map((r) => ({ value: r.id, label: r.name, group: r.category || t('climate.resource.other') })));
          const sel = basic.select('', opts, pick.resource ? pick.resource.id : '', (v) => choose({ [m.key]: v }, m.key), { 'aria-label': t('climate.resource', { name: m.label }), 'data-climate-material': m.key, inline: true });
          return h('div', { class: 'dm-row-wrap', 'data-climate-material-row': m.key }, text, sel,
            pick.resource && !pick.chosen ? h('dm-badge', { text: t('climate.choice.proposal'), title: t('climate.choice.proposal.hint') }) : null);
        });
        const open = list.filter((m) => { const p = picked.get(m.key); return p && p.resource && !p.chosen; });
        const head = h('div', { class: 'dm-row-wrap', 'data-climate-result': 'materials' },
          h('span', { class: 'dm-help dm-grow', text: (db ? t('climate.note.materials') + ' ' : '') + notes(data, decided, rows, '') }),
          db ? ui.button({ label: t('climate.accept'), icon: 'check', size: 'sm', title: t('climate.accept.hint'), disabled: !open.length, 'data-climate-accept': '', onClick: () => choose(Object.fromEntries(open.map((m) => [m.key, picked.get(m.key).resource.id]))) }) : null);
        replace(resultEl, head, h('div', { class: 'dm-stack-sm' }, lines.length ? lines : [h('p', { class: 'dm-help', text: t('climate.material.none') })]));
      }
      /** Keep the person's choices of resource and draw again, with the focus back on the select that changed. */
      async function choose(picks, focusKey) {
        choices = await climate.choose(picks);
        refresh();
        if (focusKey) refocus(`[data-climate-material="${CSS.escape(focusKey)}"]`);
      }
      const refocus = (selector) => requestAnimationFrame(() => { const el = /** @type {any} */ (document.querySelector(selector)); if (el) el.focus(); });

      /** The elements to settle, in groups: what they count as now, why, and a choice of category for the whole group. */
      function settle(ds, resultEl, decided, hooks) {
        const groups = climate.settleGroups(decided.elements, settled || {});
        const now = (g) => t('climate.settle.now', { category: t('climate.cat.' + g.category) }) + (g.uncertain ? ' (' + t('climate.decision.uncertain').toLowerCase() + ')' : '');
        const lines = groups.map((g, i) => {
          const sel = basic.select('', [{ value: '', label: t('climate.settle.rules') }].concat(SETTLE_TO.map((c) => ({ value: c, label: t('climate.cat.' + c) }))), g.choice,
            (v) => settleGroup(g, v, i), { 'aria-label': t('climate.settle.choose', { name: g.label }), 'data-climate-settle': String(i), inline: true });
          return h('div', { class: 'dm-row-wrap', 'data-climate-settle-row': String(i) },
            h('span', { class: 'dm-grow' }, h('strong', { text: `${g.label} (${i18n.formatNumber(g.count)})` }), h('br'), h('span', { class: 'dm-help', text: `${g.text} · ${now(g)}` })), sel);
        });
        const table = Object.assign(climate.settleTable(decided.elements), { name: `${ds.name}: ${t('climate.view.settle')}`, note: t('climate.note.settle.list') });
        const head = h('div', { class: 'dm-row-wrap', 'data-climate-result': 'settle' },
          h('span', { class: 'dm-help dm-grow', text: groups.length ? t('climate.note.settle.help') : t('climate.note.settle.none') }),
          ui.button({ label: t('text.create.dataset'), icon: 'table', size: 'sm', disabled: !table.rows.length, onClick: () => hooks.createDataset(table) }));
        replace(resultEl, head, h('div', { class: 'dm-stack-sm' }, lines));
      }
      /** Settle a whole group; the empty choice hands it back to the rules. */
      async function settleGroup(group, value, index) {
        settled = await climate.settle(Object.fromEntries(group.guids.map((g) => [g, value || null])));
        refresh();
        refocus(`[data-climate-settle="${index}"]`);
      }

      /** The source and the limits, for the inspector. */
      function inspector() {
        return [h('p', { class: 'dm-help', text: t('climate.inspector.preliminary') }), h('p', { class: 'dm-help', text: db ? sourceText() : t('climate.inspector.source') })];
      }

      return { fields, run, inspector, state: s };
    }
    return { create, VIEWS };
  });
})();
