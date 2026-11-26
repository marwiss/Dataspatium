// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A digital comprehensive plan's text and files beside its map in the plan view (ui/bearbeta/plan-view): the tabs Karta,
 * Ställningstaganden and Filer above the centre (only those that have something to show, so a plan without them looks as
 * before), the sections of the plan's text documents with the ställningstaganden first and those that concern the whole plan at
 * the top (headings and text as text only), a section's areas marked on the map, the sections that concern a chosen area in the
 * inspector, and the delivery's files with their roles and sizes, opened under the safe rule of data/dataset-files.tabType (only
 * a PDF or a picture opens in a tab; every other file is downloaded) and with the warnings the delivery was read with.
 *
 * The sections and the files come through `delivery`, which has the names data/plan-delivery exports (sectionsOf,
 * sectionsForObject, objectsForSection, addFiles): `delivery` is that module. `ownDelivery` reads the side tables `_sections`
 * and `_section_links` directly, the same way, and stays for the tests that build a plan's tables by hand.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/plan-sections', ['ui/base', 'ui/basic', 'ui/icons', 'data/datasets', 'data/dataset-files', 'platform/files', 'data/plan-delivery'], (base, basic, icons, datasets, dsFiles, files, planDelivery) => {
    const { h, t, i18n, replace } = base;
    /** The section type Ställningstagande in Boverket's ÖP catalogue. */
    const STATEMENT_UUID = '56d85084-b9d9-43c4-8243-1fbd3b6d3205';
    /** The roles of a delivery's files (`_files.kind`). */
    const ROLES = ['plankarta', 'underlag', 'textdokument', 'bilaga', 'manifest', 'metadata', 'ovrigt'];
    /** The sorts of `_files` the app made itself, never listed. */
    const DERIVED = new Set(['preview', 'thumb']);
    /** Shown of a section's text in the inspector. */
    const EXCERPT = 280;

    // ---- the side tables (stands in for data/plan-delivery until it is merged) ---------------------------------------------
    const str = (v) => (v === null || v === undefined ? '' : String(v));
    /** An object's identity as compared: trimmed, lower case, without braces. */
    const idOf = (v) => str(v).trim().toLowerCase().replace(/[{}]/g, '');
    const SECTION_FIELDS = 'avsnitt, dokument, rubrik, text, typ, ordning';
    async function tableIn(engine, name) {
      const r = await engine.exec('select 1 from sqlite_master where type = \'table\' and name = ?', [name]);
      return !!(r[0] && r[0].values.length);
    }
    const sectionRows = (r) => (r[0] ? r[0].values : []).map((v) => ({ avsnitt: str(v[0]), dokument: str(v[1]), rubrik: str(v[2]), text: str(v[3]), typ: str(v[4]), ordning: Number(v[5]) || 0 }));
    /** The role a file added by hand gets from its name. */
    function roleOf(name) {
      const n = str(name).toLowerCase();
      if (/(^|\/)manifest\.xml$/.test(n)) return 'manifest';
      if (/(^|\/)metadata\.xml$|premis\.xml$/.test(n)) return 'metadata';
      if (/\.gpkg$/.test(n)) return 'plankarta';
      if (/\.docx$/.test(n)) return 'textdokument';
      if (/\.(pdf|png|jpe?g)$/.test(n)) return 'bilaga';
      return 'ovrigt';
    }
    async function sha256(bytes) {
      const subtle = globalThis.crypto && globalThis.crypto.subtle;
      if (!subtle) return '';
      try { return Array.from(new Uint8Array(await subtle.digest('SHA-256', bytes)), (b) => b.toString(16).padStart(2, '0')).join(''); } catch (_e) { return ''; }
    }
    const ownDelivery = {
      /** The sections of the plan's text documents in their order. @param {string} id @returns {Promise<any[]>} */
      async sectionsOf(id) {
        const hd = await datasets.ensureOpen(id);
        if (!(await tableIn(hd.engine, '_sections'))) return [];
        return sectionRows(await hd.engine.exec(`select ${SECTION_FIELDS} from _sections order by ordning, rowid`));
      },
      /** The sections that concern an object ('' for the whole plan). @param {string} id @param {string} objektid @returns {Promise<any[]>} */
      async sectionsForObject(id, objektid) {
        const hd = await datasets.ensureOpen(id);
        if (!(await tableIn(hd.engine, '_sections')) || !(await tableIn(hd.engine, '_section_links'))) return [];
        const r = await hd.engine.exec(`select ${SECTION_FIELDS.split(', ').map((c) => 's.' + c).join(', ')} from _sections s where exists (select 1 from _section_links l where l.avsnitt = s.avsnitt`
          + ' and replace(replace(lower(trim(coalesce(l.objektid, \'\'))), \'{\', \'\'), \'}\', \'\') = ?'
          + ' and (coalesce(l.dokument, \'\') = \'\' or coalesce(s.dokument, \'\') = \'\' or l.dokument = s.dokument)) order by s.ordning, s.rowid', [idOf(objektid)]);
        return sectionRows(r);
      },
      /** The objects a section concerns, '' for the whole plan. @param {string} id @param {string} avsnitt @returns {Promise<string[]>} */
      async objectsForSection(id, avsnitt) {
        const hd = await datasets.ensureOpen(id);
        if (!(await tableIn(hd.engine, '_section_links'))) return [];
        const r = await hd.engine.exec('select distinct coalesce(objektid, \'\') from _section_links where avsnitt = ?', [str(avsnitt)]);
        return (r[0] ? r[0].values : []).map((v) => str(v[0]));
      },
      /**
       * Add files to the plan's delivery: kept in `_files` with a role from the name (a file of the same name and role replaced)
       * and listed in `_meta.plan.leverans.filer` with size and SHA-256. Unlike data/plan-delivery it reads nothing out of them.
       * @param {string} id @param {File[]} list @returns {Promise<Array<{name: string, role: string}>>}
       */
      async addFiles(id, list) {
        const hd = await datasets.ensureOpen(id);
        const made = [];
        for (const f of list || []) made.push({ name: f.name, kind: roleOf(f.name), type: f.type || 'application/octet-stream', bytes: new Uint8Array(await f.arrayBuffer()) });
        if (!made.length) return [];
        await dsFiles.ensureTable(hd.engine);
        for (const f of made) await hd.engine.run('delete from _files where name = ? and kind = ?', [f.name, f.kind]);
        await dsFiles.put(hd, made);
        const info = Object.assign({}, hd.meta.plan || {});
        const leverans = Object.assign({ filer: [], varningar: [] }, info.leverans || {});
        const listed = (Array.isArray(leverans.filer) ? leverans.filer : []).filter((x) => !made.some((f) => x && x.namn === f.name));
        for (const f of made) listed.push({ namn: f.name, roll: f.kind, storlek: f.bytes.byteLength, sha256: await sha256(f.bytes) });
        info.leverans = Object.assign(leverans, { filer: listed });
        hd.meta.plan = info;
        await hd.engine.run('insert or replace into _meta (key, value) values (?, ?)', ['plan', JSON.stringify(info)]);
        await datasets.save(id);
        datasets.notify('changed', { id });
        return made.map((f) => ({ name: f.name, role: f.kind }));
      },
    };
    /** Where the view reads a delivery's sections and adds its files: data/plan-delivery. */
    const delivery = planDelivery;

    // ---- the view -------------------------------------------------------------------------------------------------------
    /** True for a section of the type Ställningstagande (by name or by the catalogue's id). */
    const isStatement = (s) => /ställningstagande/i.test(str(s.typ)) || str(s.typ).toLowerCase().includes(STATEMENT_UUID);
    const typeLabel = (s) => (str(s.typ).toLowerCase().includes(STATEMENT_UUID) ? t('plan.sections.statement') : str(s.typ));
    const headingOf = (s) => s.rubrik || s.avsnitt || '–';
    const excerpt = (text) => (text.length > EXCERPT ? text.slice(0, EXCERPT).replace(/\s+\S*$/, '') + ' …' : text);
    /** Whether a dataset's file belongs to the list of the delivery's files. */
    const listedFile = (f) => !DERIVED.has(f.kind);
    /** A file's role as words. */
    const roleLabel = (role) => (i18n.has('plan.files.role.' + role) ? t('plan.files.role.' + role) : role);

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
     * @param {{mark: (ids: string[], section: any|null) => void, shown: () => void, changed: () => void, editor?: any}} options `mark` marks
     *   the objects on the map and fits the view to them, `shown` tells that the map shows again, `changed` that the plan changed;
     *   `editor` (ui/bearbeta/plan-edit) adds its buttons to the sections and keeps the tab when the plan has none yet
     */
    function create(ctx, options) {
      const { ui } = ctx;
      /** The plan's editor (ui/bearbeta/plan-edit), when the view has one: its buttons go with the sections in edit mode. */
      const editor = options.editor || null;
      const st = { id: null, tab: 'map', sections: [], objects: new Map(), whole: [], files: [], plan: {}, chosen: null, current: null, filesShown: false };
      let tabs = null; let panes = null; let seq = 0;

      /**
       * The centre below the page's head: the map alone when the plan has neither sections nor a delivery's files, else the tabs
       * with the map, the sections and the files. @param {any} ds @param {HTMLElement} mapEl @returns {Promise<HTMLElement>}
       */
      async function mount(ds, mapEl) {
        const my = ++seq;
        if (st.id !== ds.id) Object.assign(st, { id: ds.id, tab: 'map', chosen: null, current: null });
        st.plan = ds.plan || {};
        const [sections, list] = await Promise.all([delivery.sectionsOf(ds.id).catch(() => []), dsFiles.list(ds.id).catch(() => [])]);
        const names = Array.from(new Set(sections.map((s) => s.avsnitt)));
        const found = await Promise.all(names.map((a) => delivery.objectsForSection(ds.id, a).catch(() => [])));
        const objects = new Map(names.map((a, i) => [a, found[i]]));
        if (my !== seq) return mapEl;
        const planId = idOf(st.plan.objektid);
        const wholePlan = (ids) => ids.some((x) => !idOf(x) || (planId && idOf(x) === planId));
        st.sections = sections; st.objects = objects;
        st.whole = sections.filter((s) => wholePlan(objects.get(s.avsnitt) || []));
        st.files = list.filter(listedFile);
        st.filesShown = !!st.plan.leverans || list.some((f) => ROLES.includes(f.kind));
        const ids = ['map'].concat(sections.length || (editor && editor.editing) ? ['text'] : [], st.filesShown ? ['files'] : []);
        if (!ids.includes(st.tab)) st.tab = 'map';
        if (ids.length === 1) { tabs = null; panes = null; return mapEl; }
        tabs = /** @type {any} */ (h('dm-tabs', { 'data-plan-tabs': '' }));
        const ICONS = { map: 'map', text: 'book-open', files: 'folder-open' };
        tabs.tabs = ids.map((id) => ({ id, label: id === 'text' ? t('plan.tab.text') : id === 'files' ? t('plan.tab.files') : t('plan.tab.map'), icon: ICONS[id] }));
        tabs.active = st.tab;
        tabs.addEventListener('dm-change', (e) => showTab(/** @type {any} */ (e).detail.id));
        panes = { map: mapEl, text: textPane(), files: filesPane() };
        const body = h('div', { class: 'dm-center-fill dm-plan-body' }, tabs, mapEl, panes.text, panes.files);
        showPanes();
        return body;
      }
      function showPanes() {
        if (!panes) return;
        for (const [id, el] of Object.entries(panes)) if (el) el.hidden = id !== st.tab;
      }
      /** Show a tab ('map', 'text' or 'files'). @param {string} id */
      function showTab(id) {
        if (!panes || !panes[id]) return;
        const was = st.tab;
        st.tab = id;
        if (tabs && tabs.active !== id) tabs.active = id;
        showPanes();
        if (id === 'map' && was !== 'map') options.shown();
      }

      /** One section: its heading, type and document, its text as text, and the button that marks its areas. */
      function article(s) {
        const ids = (st.objects.get(s.avsnitt) || []).filter((x) => idOf(x) && idOf(x) !== idOf(st.plan.objektid));
        const head = h('h4', { tabindex: '-1', text: headingOf(s) });
        return h('article', { class: 'dm-plan-section' + (st.current === s.avsnitt ? ' dm-plan-section-current' : ''), 'data-plan-section': s.avsnitt },
          h('div', { class: 'dm-plan-section-head' }, head, s.typ ? h('dm-badge', { kind: isStatement(s) ? 'accent' : null, text: typeLabel(s) }) : null),
          s.dokument ? h('p', { class: 'dm-help dm-small', text: s.dokument }) : null,
          s.text ? h('p', { class: 'dm-plan-section-text', text: s.text }) : h('p', { class: 'dm-help dm-small', text: t('plan.sections.notext') }),
          ids.length ? h('div', { class: 'dm-row-wrap' }, basic.button({ label: t('plan.sections.map', { n: ids.length }), icon: 'map', size: 'sm', title: t('plan.sections.map.hint'), 'data-plan-section-map': s.avsnitt, onClick: () => choose(s) })) : null,
          editor ? editor.sectionTools(s) : null);
      }
      /** The sections: those about the whole plan at the top, then the ställningstaganden, then the others. */
      function textPane() {
        const whole = new Set(st.whole.map((s) => s.avsnitt));
        const rest = st.sections.filter((s) => !whole.has(s.avsnitt));
        const statements = rest.filter(isStatement);
        const others = rest.filter((s) => !isStatement(s));
        const block = (key, list, attrs) => (list.length ? h('section', Object.assign({ class: 'dm-stack-sm dm-plan-sections-block' }, attrs), h('h3', { text: `${t(key)} (${i18n.formatNumber(list.length)})` }), list.map(article)) : null);
        return h('div', { class: 'dm-plan-text', 'data-plan-text': '' },
          editor ? editor.textHead() : null,
          !st.sections.length ? h('p', { class: 'dm-help', text: t('plan.edit.section.empty') }) : null,
          st.whole.length ? h('section', { class: 'dm-card dm-stack-sm', 'data-plan-whole': '' }, h('h3', { text: t('plan.sections.whole') }), st.whole.map(article)) : null,
          block('plan.sections.statements', statements, { 'data-plan-statements': '' }),
          block('plan.sections.others', others, { 'data-plan-others': '' }));
      }
      /** A section chosen: its areas marked on the map, which shows and fits them. */
      function choose(s) {
        st.chosen = s; st.current = s.avsnitt;
        showTab('map');
        options.mark((st.objects.get(s.avsnitt) || []).filter((x) => idOf(x)), s);
      }
      /** The tab Ställningstaganden at a section, which is marked and gets the focus. @param {string} avsnitt */
      function reveal(avsnitt) {
        st.current = avsnitt;
        showTab('text');
        if (!panes || !panes.text) return;
        let found = null;
        for (const el of Array.from(panes.text.querySelectorAll('[data-plan-section]'))) {
          const on = el.getAttribute('data-plan-section') === avsnitt;
          el.classList.toggle('dm-plan-section-current', on);
          if (on && !found) found = el;
        }
        if (found) { if (found.scrollIntoView) found.scrollIntoView({ block: 'start' }); const head = /** @type {HTMLElement|null} */ (found.querySelector('h4')); if (head) head.focus({ preventScroll: true }); }
      }

      /** The sections that concern an object, for the inspector, filled in when read. @param {string} objektid @returns {HTMLElement|null} */
      function forObject(objektid) {
        if (!st.sections.length || !st.id) return null;
        const id = st.id;
        const box = h('div', { class: 'dm-stack-sm', 'data-plan-object-sections': '' }, h('h4', { text: t('plan.sections.object') }), h('p', { class: 'dm-help dm-small', text: t('common.loading') }));
        delivery.sectionsForObject(id, str(objektid)).then((list) => {
          if (st.id !== id) return;
          const statements = list.filter(isStatement); const others = list.filter((s) => !isStatement(s));
          const ordered = statements.concat(others);
          replace(box, h('h4', { text: t('plan.sections.object') }), ordered.length ? h('ul', { class: 'dm-plan-object-sections' }, ordered.map((s) => h('li', { 'data-plan-object-section': s.avsnitt },
            h('div', { class: 'dm-row-wrap' }, s.typ ? h('dm-badge', { kind: isStatement(s) ? 'accent' : null, text: typeLabel(s) }) : null, h('strong', { text: headingOf(s) })),
            s.text ? h('p', { class: 'dm-small dm-plan-section-text', text: excerpt(s.text) }) : null,
            h('div', { class: 'dm-row-wrap' }, basic.button({ label: t('plan.sections.reveal'), icon: 'book-open', size: 'sm', title: t('plan.sections.reveal.hint'), 'data-plan-reveal': s.avsnitt, onClick: () => reveal(s.avsnitt) }), editor ? editor.objectSectionTools(s, objektid) : null)))) : h('p', { class: 'dm-help dm-small', text: t('plan.sections.object.none') }));
        }).catch((err) => { replace(box, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) })); });
        return box;
      }
      /** The section whose areas are marked, for the inspector, with the way back to its text and to clear the marking. */
      function chosenBlock() {
        const s = st.chosen;
        if (!s) return null;
        return h('div', { class: 'dm-stack-sm', 'data-plan-chosen': s.avsnitt }, h('h4', { text: t('plan.sections.chosen') }),
          h('div', { class: 'dm-row-wrap' }, s.typ ? h('dm-badge', { kind: isStatement(s) ? 'accent' : null, text: typeLabel(s) }) : null, h('strong', { text: headingOf(s) })),
          s.text ? h('p', { class: 'dm-small dm-plan-section-text', text: excerpt(s.text) }) : null,
          h('div', { class: 'dm-row-wrap' },
            basic.button({ label: t('plan.sections.reveal'), icon: 'book-open', size: 'sm', title: t('plan.sections.reveal.hint'), onClick: () => reveal(s.avsnitt) }),
            basic.button({ label: t('plan.sections.clear'), icon: 'x', size: 'sm', variant: 'ghost', title: t('plan.sections.clear.hint'), 'data-plan-clear': '', onClick: () => clear() })));
      }
      /** No section chosen, nothing marked. */
      function clear() { st.chosen = null; options.mark([], null); }

      /** The delivery's files with role and size, the warnings it was read with and the button that adds a file. */
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

      function destroy() { seq++; tabs = null; panes = null; }
      return { mount, showTab, reveal, choose, clear, forObject, chosenBlock, add, destroy, state: st, get tab() { return st.tab; } };
    }

    return { STATEMENT_UUID, ROLES, delivery, ownDelivery, isStatement, roleOf, openFile, create };
  });
})();
