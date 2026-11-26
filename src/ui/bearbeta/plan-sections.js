// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A digital comprehensive plan's text and files beside its map in the plan view (ui/bearbeta/plan-view): the map and the plan
 * description side by side in the centre, with a splitter (dm-splitter for="pane") whose width is kept, stacked in the narrow
 * layouts; the description has the sections of the plan's text documents, those about the whole plan at the top and the
 * ställningstaganden first (headings and text as text only), and Filer, a tab beside it, has the delivery's files with their
 * roles and sizes (opened under the safe rule of data/dataset-files.tabType: only a PDF or a picture opens in a tab; every
 * other file is downloaded), how its links between map and text were read and the warnings it was read with. A plan with
 * neither sections nor files keeps its map alone.
 *
 * Choosing a section marks all its areas on the map; choosing areas (one, or several with Shift or a rectangle) lists in the
 * inspector the union of the sections that concern them, each with the areas it covers and the way to its text. A link only
 * the text gives (data/plan-links, kalla 'text') is shown as Nämnd i texten. The sections and links come from data/plan-delivery
 * once per drawing and are looked up in memory, by ids compared without case and braces.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/plan-sections', ['ui/base', 'ui/basic', 'ui/icons', 'data/dataset-files', 'platform/files', 'platform/storage/idb', 'data/plan-delivery', 'data/plan-links'], (base, basic, icons, dsFiles, files, idb, planDelivery, planLinks) => {
    const { h, t, i18n, replace } = base;
    /** The section type Ställningstagande in Boverket's ÖP catalogue. */
    const STATEMENT_UUID = '56d85084-b9d9-43c4-8243-1fbd3b6d3205';
    /** The roles of a delivery's files (`_files.kind`). */
    const ROLES = ['plankarta', 'underlag', 'textdokument', 'bilaga', 'manifest', 'metadata', 'ovrigt'];
    /** The sorts of `_files` the app made itself, never listed. */
    const DERIVED = new Set(['preview', 'thumb']);
    /** Shown of a section's text in the inspector. */
    const EXCERPT = 280;
    /** The width of the plan description beside the map, kept for every plan. */
    const SPLIT_SETTING = 'ui.plan.text';
    /** Areas named in a section's line in the inspector, at most. */
    const NAMED = 6;
    /** Where the view reads a delivery's sections and adds its files. */
    const delivery = planDelivery;

    const str = (v) => (v === null || v === undefined ? '' : String(v));
    const key = planLinks.key;
    /** True for a section of the type Ställningstagande (by name or by the catalogue's id). */
    const isStatement = (s) => planLinks.isStatement(s.typ);
    const typeLabel = (s) => (str(s.typ).toLowerCase().includes(STATEMENT_UUID) ? t('plan.sections.statement') : str(s.typ));
    const headingOf = (s) => s.rubrik || s.avsnitt || '–';
    const excerpt = (text) => (text.length > EXCERPT ? text.slice(0, EXCERPT).replace(/\s+\S*$/, '') + ' …' : text);
    /** Whether a dataset's file belongs to the list of the delivery's files. */
    const listedFile = (f) => !DERIVED.has(f.kind);
    /** A file's role as words. */
    const roleLabel = (role) => (i18n.has('plan.files.role.' + role) ? t('plan.files.role.' + role) : role);
    /** The badge of a link the text only gives. */
    const textBadge = () => h('dm-badge', { kind: 'warn', text: t('plan.link.text'), title: t('plan.link.text.hint'), 'data-plan-link-text': '' });

    /**
     * Open a dataset's file: in a tab only when it is a PDF or a picture whose first bytes agree (with the type chosen here, never
     * the stored one), else downloaded. @param {string} id @param {{name: string, kind: string}} f
     */
    async function openFile(id, f) {
      const file = await dsFiles.read(id, f.name, f.kind);
      if (!file) return 'missing';
      const shown = f.name.split('/').pop() || f.name;
      const type = dsFiles.tabType(f.name, file.bytes);
      if (!type) { files.download(new Blob([file.bytes], { type: 'application/octet-stream' }), shown); return 'download'; }
      const u = URL.createObjectURL(new Blob([file.bytes], { type }));
      window.open(u, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(u), 60000);
      return 'open';
    }

    /**
     * The plan view's text and files.
     * @param {any} ctx shell context
     * @param {{mark: (ids: string[], section: any|null) => void, shown: () => void, changed: () => void, nameOf?: (id: string) => string}} options
     *   `mark` marks the objects on the map and fits the view to them, `shown` tells that the map's size changed, `changed` that
     *   the plan changed, `nameOf` an object's name for the lists
     */
    function create(ctx, options) {
      const { ui } = ctx;
      const st = { id: null, tab: 'text', sections: [], objects: new Map(), byObject: new Map(), whole: [], files: [], plan: {}, chosen: null, current: null, filesShown: false, links: 0 };
      let tabs = null; let panes = null; let split = null; let seq = 0;
      const nameOf = (id) => (options.nameOf ? options.nameOf(id) : '') || id;

      /**
       * The centre below the page's head: the map alone when the plan has neither sections nor a delivery's files, else the map
       * and the plan description side by side. @param {any} ds @param {HTMLElement} mapEl @returns {Promise<HTMLElement>}
       */
      async function mount(ds, mapEl) {
        const my = ++seq;
        if (st.id !== ds.id) Object.assign(st, { id: ds.id, tab: 'text', chosen: null, current: null });
        st.plan = ds.plan || {};
        const [sections, list, width] = await Promise.all([delivery.sectionsOf(ds.id).catch(() => []), dsFiles.list(ds.id).catch(() => []), idb.getSetting(SPLIT_SETTING, null).catch(() => null)]);
        if (my !== seq) return mapEl;
        index(sections);
        st.files = list.filter(listedFile);
        st.filesShown = !!st.plan.leverans || list.some((f) => ROLES.includes(f.kind));
        const ids = (sections.length ? ['text'] : []).concat(st.filesShown ? ['files'] : []);
        if (!ids.includes(st.tab)) st.tab = ids[0] || 'text';
        if (!ids.length) { tabs = null; panes = null; split = null; return mapEl; }
        tabs = null;
        if (ids.length > 1) {
          tabs = /** @type {any} */ (h('dm-tabs', { 'data-plan-tabs': '' }));
          const ICONS = { text: 'book-open', files: 'folder-open' };
          tabs.tabs = ids.map((id) => ({ id, label: t(id === 'text' ? 'plan.tab.text' : 'plan.tab.files'), icon: ICONS[id] }));
          tabs.active = st.tab;
          tabs.addEventListener('dm-change', (e) => showTab(/** @type {any} */ (e).detail.id));
        }
        panes = { text: sections.length ? textPane() : null, files: st.filesShown ? filesPane() : null };
        const splitter = h('dm-splitter', { for: 'pane', 'aria-label': t('plan.split') });
        split = h('div', { class: 'dm-plan-split', 'data-plan-split': '' }, mapEl, splitter,
          h('section', { class: 'dm-plan-side', 'aria-label': t('plan.text.pane'), 'data-plan-side': '' }, tabs, panes.text, panes.files));
        if (typeof width === 'number' && width > 0) split.style.setProperty('--dm-split-w', width + 'px');
        // The width is kept for every plan; the map is told that its size changed.
        split.addEventListener('dm-resize', (e) => {
          const d = /** @type {CustomEvent} */ (e).detail;
          if (!d || d.side !== 'pane') return;
          (d.width === null ? idb.deleteSetting(SPLIT_SETTING) : idb.setSetting(SPLIT_SETTING, d.width)).catch((err) => D.log('plan-sections', 'width', err));
          options.shown();
        });
        showPanes();
        return h('div', { class: 'dm-center-fill dm-plan-body' }, split);
      }
      /** The sections, and per object the sections that concern it with where each link was read. */
      function index(sections) {
        const planId = key(st.plan.objektid);
        st.sections = sections;
        st.objects = new Map(); st.byObject = new Map(); st.links = 0;
        for (const s of sections) {
          const objekt = (s.objekt || []).filter((x) => key(x) && key(x) !== planId);
          const kallor = (s.kallor || []).filter((_k, i) => key((s.objekt || [])[i]) && key((s.objekt || [])[i]) !== planId);
          st.objects.set(s.avsnitt, (st.objects.get(s.avsnitt) || []).concat(objekt));
          objekt.forEach((id, i) => { const k = key(id); st.byObject.set(k, (st.byObject.get(k) || []).concat({ s, kalla: kallor[i] || 'modell' })); });
          st.links += objekt.length + (s.helaPlanen ? 1 : 0);
        }
        st.whole = sections.filter((s) => s.helaPlanen || (s.objekt || []).some((x) => planId && key(x) === planId));
      }
      function showPanes() {
        if (!panes) return;
        for (const [id, el] of Object.entries(panes)) if (el) el.hidden = id !== st.tab;
      }
      /** Show the side's tab ('text' or 'files'); 'map' is always shown and only kept for callers of the tabbed view. @param {string} id */
      function showTab(id) {
        if (id === 'map') { options.shown(); return; }
        if (!panes || !panes[id]) return;
        st.tab = id;
        if (tabs && tabs.active !== id) tabs.active = id;
        showPanes();
      }

      /** One section: its heading, type and document, its text as text, and the button that marks its areas. */
      function article(s) {
        const ids = st.objects.get(s.avsnitt) || [];
        const kallor = new Set((s.kallor || []).filter(Boolean));
        const head = h('h4', { tabindex: '-1', text: headingOf(s) });
        return h('article', { class: 'dm-plan-section' + (st.current === s.avsnitt ? ' dm-plan-section-current' : ''), 'data-plan-section': s.avsnitt },
          h('div', { class: 'dm-plan-section-head' }, head, s.typ ? h('dm-badge', { kind: isStatement(s) ? 'accent' : null, text: typeLabel(s) }) : null, kallor.size === 1 && kallor.has('text') ? textBadge() : null),
          s.dokument ? h('p', { class: 'dm-help dm-small', text: s.dokument }) : null,
          s.text ? h('p', { class: 'dm-plan-section-text', text: s.text }) : h('p', { class: 'dm-help dm-small', text: t('plan.sections.notext') }),
          ids.length ? h('div', { class: 'dm-row-wrap' }, basic.button({ label: t('plan.sections.map', { n: ids.length }), icon: 'map', size: 'sm', title: t('plan.sections.map.hint'), 'data-plan-section-map': s.avsnitt, onClick: () => choose(s) })) : null);
      }
      /**
       * The plan description: the sections about the whole plan at the top, then the ställningstaganden, then the others.
       * Builds the text pane anew from the sections read (a hook for views that change them).
       */
      function textPane() {
        const whole = new Set(st.whole.map((s) => s.avsnitt));
        const rest = st.sections.filter((s) => !whole.has(s.avsnitt));
        const statements = rest.filter(isStatement);
        const others = rest.filter((s) => !isStatement(s));
        const block = (k, list, attrs) => (list.length ? h('section', Object.assign({ class: 'dm-stack-sm dm-plan-sections-block' }, attrs), h('h3', { text: `${t(k)} (${i18n.formatNumber(list.length)})` }), list.map(article)) : null);
        return h('div', { class: 'dm-plan-text', 'data-plan-text': '' },
          st.whole.length ? h('section', { class: 'dm-card dm-stack-sm', 'data-plan-whole': '' }, h('h3', { text: t('plan.sections.whole') }), st.whole.map(article)) : null,
          block('plan.sections.statements', statements, { 'data-plan-statements': '' }),
          block('plan.sections.others', others, { 'data-plan-others': '' }));
      }
      /** Mark a section as the current one in the text. */
      function markCurrent(avsnitt) {
        st.current = avsnitt;
        if (!panes || !panes.text) return null;
        let found = null;
        for (const el of Array.from(panes.text.querySelectorAll('[data-plan-section]'))) {
          const on = el.getAttribute('data-plan-section') === avsnitt;
          el.classList.toggle('dm-plan-section-current', on);
          if (on && !found) found = el;
        }
        return found;
      }
      /** A section chosen: all its areas marked on the map, which fits them, and the section marked in the text. */
      function choose(s) {
        st.chosen = s;
        markCurrent(s.avsnitt);
        options.mark((st.objects.get(s.avsnitt) || []).filter((x) => key(x)), s);
      }
      /** The plan description at a section, which is marked and gets the focus. @param {string} avsnitt */
      function reveal(avsnitt) {
        showTab('text');
        const found = markCurrent(avsnitt);
        if (found) { if (found.scrollIntoView) found.scrollIntoView({ block: 'start' }); const head = /** @type {HTMLElement|null} */ (found.querySelector('h4')); if (head) head.focus({ preventScroll: true }); }
      }

      /** Names in a line, at most NAMED, with how many more. */
      const namesLine = (list) => list.slice(0, NAMED).join(', ') + (list.length > NAMED ? ' ' + t('plan.select.more', { n: list.length - NAMED }) : '');
      /**
       * The sections that concern the chosen areas, for the inspector: their union, ställningstaganden first and in document
       * order, each with the chosen areas it covers (when several are chosen), the badge Nämnd i texten for a link the text only
       * gives, and the way to its text. Says why when nothing can be listed: an area without identity, a plan without links.
       * @param {any[]} rows the chosen rows @returns {HTMLElement|null}
       */
      function forObjects(rows) {
        if (!st.id || !rows || !rows.length) return null;
        const many = rows.length > 1;
        const box = h('div', { class: 'dm-stack-sm', 'data-plan-object-sections': '' }, h('h4', { text: t(many ? 'plan.select.statements' : 'plan.sections.object') }));
        const note = (k) => { box.appendChild(h('p', { class: 'dm-help dm-small', 'data-plan-object-note': k, text: t(k) })); return box; };
        const withId = rows.filter((r) => key(r.objektid));
        if (!withId.length) return note('plan.sections.object.noid');
        if (!st.links) return st.sections.length || st.filesShown ? note('plan.sections.object.nolinks') : null;
        const by = new Map();
        for (const r of withId) {
          for (const e of st.byObject.get(key(r.objektid)) || []) {
            const k = e.s.dokument + '\u0000' + e.s.avsnitt;
            const item = by.get(k) || { s: e.s, areas: [] };
            if (!item.areas.some((a) => a.row === r)) item.areas.push({ row: r, kalla: e.kalla });
            by.set(k, item);
          }
        }
        const items = Array.from(by.values()).sort((a, b) => (isStatement(b.s) - isStatement(a.s)) || (a.s.ordning - b.s.ordning));
        if (!items.length) return note(many ? 'plan.select.none' : 'plan.sections.object.none');
        const label = (r) => r.namn || r.innehallstyp || nameOf(String(r.objektid));
        box.appendChild(h('ul', { class: 'dm-plan-object-sections' }, items.map(({ s, areas }) => {
          const inferred = areas.every((a) => a.kalla === 'text');
          return h('li', { 'data-plan-object-section': s.avsnitt },
            h('div', { class: 'dm-row-wrap' }, s.typ ? h('dm-badge', { kind: isStatement(s) ? 'accent' : null, text: typeLabel(s) }) : null, h('strong', { text: headingOf(s) }), inferred ? textBadge() : null),
            many ? h('p', { class: 'dm-small', 'data-plan-covers': '', text: t('plan.select.covers', { areas: namesLine(areas.map((a) => label(a.row) + (a.kalla === 'text' && !inferred ? ` (${t('plan.link.text').toLowerCase()})` : ''))) }) }) : null,
            s.text ? h('p', { class: 'dm-small dm-plan-section-text', text: excerpt(s.text) }) : null,
            basic.button({ label: t('plan.sections.reveal'), icon: 'book-open', size: 'sm', title: t('plan.sections.reveal.hint'), 'data-plan-reveal': s.avsnitt, onClick: () => reveal(s.avsnitt) }));
        })));
        return box;
      }
      /** The sections that concern one object (kept for callers of one id). @param {string} objektid */
      const forObject = (objektid) => forObjects([{ objektid }]);
      /** The section whose areas are marked, for the inspector, with its areas, the way back to its text and to clear the marking. */
      function chosenBlock() {
        const s = st.chosen;
        if (!s) return null;
        const ids = st.objects.get(s.avsnitt) || [];
        return h('div', { class: 'dm-stack-sm', 'data-plan-chosen': s.avsnitt }, h('h4', { text: t('plan.sections.chosen') }),
          h('div', { class: 'dm-row-wrap' }, s.typ ? h('dm-badge', { kind: isStatement(s) ? 'accent' : null, text: typeLabel(s) }) : null, h('strong', { text: headingOf(s) })),
          ids.length ? h('p', { class: 'dm-small', 'data-plan-chosen-areas': '', text: t('plan.sections.areas', { areas: namesLine(ids.map((id) => nameOf(id))) }) }) : null,
          s.text ? h('p', { class: 'dm-small dm-plan-section-text', text: excerpt(s.text) }) : null,
          h('div', { class: 'dm-row-wrap' },
            basic.button({ label: t('plan.sections.reveal'), icon: 'book-open', size: 'sm', title: t('plan.sections.reveal.hint'), onClick: () => reveal(s.avsnitt) }),
            basic.button({ label: t('plan.sections.clear'), icon: 'x', size: 'sm', variant: 'ghost', title: t('plan.sections.clear.hint'), 'data-plan-clear': '', onClick: () => clear() })));
      }
      /** No section chosen, nothing marked. */
      function clear() { st.chosen = null; markCurrent(null); options.mark([], null); }

      /** How the plan's links between map and text were read: how many and from where, what has none, and the way to read them again. */
      function linksBlock(lev) {
        const k = lev.kopplingar && typeof lev.kopplingar === 'object' ? lev.kopplingar : null;
        const relink = basic.button({ label: t('plan.files.links.relink'), icon: 'refresh-cw', size: 'sm', title: t('plan.files.links.relink.hint'), 'data-plan-relink': '', onClick: () => relinkPlan().catch((err) => ui.toast.show(String((err && err.message) || err), { kind: 'error' })) });
        const kv = /** @type {any} */ (h('dm-kv'));
        if (k) {
          const sources = (Array.isArray(k.kallor) ? k.kallor : []).filter((x) => x && x.antal).map((x) => t('plan.links.source.' + x.kalla, { n: x.antal, name: x.fran || '' })).join(', ');
          kv.items = [
            { label: t('plan.files.links.count'), value: [i18n.formatNumber(Number(k.antal) || 0), sources].filter(Boolean).join(': ') },
            k.omraden ? { label: t('plan.files.links.areas'), value: t('plan.files.links.of', { n: i18n.formatNumber(k.omradenUtan || 0), of: i18n.formatNumber(k.omraden) }) } : null,
            k.stallningstaganden ? { label: t('plan.files.links.statements'), value: t('plan.files.links.of', { n: i18n.formatNumber(k.stallningstagandenUtan || 0), of: i18n.formatNumber(k.stallningstaganden) }) } : null,
          ].filter(Boolean);
        }
        return h('div', { class: 'dm-stack-sm', 'data-plan-links': k ? String(k.antal || 0) : '' }, h('h4', { text: t('plan.files.links') }),
          k ? kv : h('p', { class: 'dm-help dm-small', text: t('plan.files.links.unknown') }),
          k && !k.antal && Array.isArray(k.orsaker) && k.orsaker.length ? h('p', { class: 'dm-small dm-warn', 'data-plan-links-why': '', text: k.orsaker.map((r) => t('plan.links.why.' + r)).join(' ') }) : null,
          h('div', { class: 'dm-row-wrap' }, relink));
      }
      /** The delivery's files with role and size, its links, the warnings it was read with and the button that adds a file. */
      function filesPane() {
        const lev = st.plan.leverans && typeof st.plan.leverans === 'object' ? st.plan.leverans : {};
        const warnings = (Array.isArray(lev.varningar) ? lev.varningar : []).map((w) => (typeof w === 'string' ? w : w && typeof w === 'object' ? [w.fil, w.text || w.meddelande || w.message || w.kod].filter(Boolean).join(': ') : '')).filter(Boolean);
        const describe = (m) => (typeof m === 'string' ? m : m && typeof m === 'object' ? [m.namn || m.fil, m.format || m.typ || m.namnrymd].filter(Boolean).map(String).join(' · ') : '');
        const facts = /** @type {any} */ (h('dm-kv'));
        facts.items = [lev.manifest ? { label: t('plan.files.manifest'), value: describe(lev.manifest) } : null, lev.metadata ? { label: t('plan.files.metadata'), value: describe(lev.metadata) } : null].filter((x) => x && x.value);
        const kept = new Set(st.files.map((f) => f.name));
        const absent = (Array.isArray(lev.filer) ? lev.filer : []).filter((x) => x && x.namn && !kept.has(x.namn));
        const id = st.id;
        const row = (f) => {
          const opens = !!dsFiles.tabType(f.name);
          return h('li', { class: 'dm-plan-file', 'data-plan-file': f.name },
            icons.icon('file', 16), h('span', { class: 'dm-truncate dm-plan-file-name', text: f.name }),
            h('dm-badge', { text: roleLabel(f.kind) }), h('span', { class: 'dm-plan-file-size', text: i18n.formatBytes(f.size) }),
            basic.button({ label: t(opens ? 'plan.archive.open' : 'common.download'), icon: opens ? 'external-link' : 'download', size: 'sm', title: t(opens ? 'plan.archive.open.hint' : 'plan.archive.download.hint'), 'data-plan-file-open': f.name,
              onClick: () => { openFile(String(id), f).catch((err) => ui.toast.show(String((err && err.message) || err), { kind: 'error' })); } }));
        };
        const add = basic.button({ label: t('plan.files.add'), icon: 'plus', title: t('plan.files.add.hint'), 'data-plan-add-file': '', onClick: () => addFromDisk().catch((err) => ui.toast.show(String((err && err.message) || err), { kind: 'error' })) });
        return h('div', { class: 'dm-plan-files dm-stack', 'data-plan-files': '' },
          st.plan.leverans ? linksBlock(lev) : null,
          warnings.length ? h('div', { class: 'dm-stack-sm', 'data-plan-warnings': '' }, h('h4', { class: 'dm-warn', text: t('plan.files.warnings', { n: warnings.length }) }), h('ul', { class: 'dm-plan-warnings' }, warnings.map((w) => h('li', { class: 'dm-small', text: w })))) : null,
          facts.items.length ? facts : null,
          st.files.length ? h('ul', { class: 'dm-plan-filelist' }, st.files.map(row)) : h('p', { class: 'dm-help', text: t('plan.files.none') }),
          absent.length ? h('p', { class: 'dm-help dm-small', 'data-plan-files-absent': '', text: t('plan.files.absent', { files: absent.map((x) => x.namn).join(', ') }) }) : null,
          h('div', { class: 'dm-row-wrap' }, add));
      }
      /** Files picked from the disk added to the plan, then the plan drawn again. */
      async function addFromDisk() {
        const picked = await files.pick({ multiple: true });
        if (!picked.length || !st.id) return;
        await add(picked);
      }
      /** Add files to the plan's delivery (data/plan-delivery's addFiles). @param {File[]} list */
      async function add(list) {
        // data/plan-delivery answers {added, sections, links, warnings}; a plain list counts too.
        const res = await delivery.addFiles(String(st.id), list);
        const added = Array.isArray(res) ? res : (res && res.added) || [];
        ui.toast.show(t('plan.files.added', { n: added.length || list.length }), { kind: 'ok' });
        st.tab = 'files';
        options.changed();
      }
      /** The plan's links read again from its files (data/plan-delivery's relink), then the plan drawn again. */
      async function relinkPlan() {
        if (!st.id) return;
        const res = await delivery.relink(String(st.id));
        ui.toast.show(t('plan.files.links.relinked', { n: res.links }), { kind: 'ok' });
        st.tab = 'files';
        options.changed();
      }

      function destroy() { seq++; tabs = null; panes = null; split = null; }
      return { mount, showTab, reveal, choose, clear, forObject, forObjects, chosenBlock, textPane, add, relink: relinkPlan, destroy, state: st, get tab() { return st.tab; }, get split() { return split; } };
    }

    return { STATEMENT_UUID, ROLES, SPLIT_SETTING, delivery, isStatement, openFile, create };
  });
})();
