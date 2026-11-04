// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Mode "Analysera": code and statistics, in five tabs that share the same layout:
 *   R      (WebR): editor on top, console output with inline plots below, saved R scripts in the object
 *                  panel, session info and snippets in the inspector.
 *   Python (Pyodide, a component fetched on first use): the same console for Python (data/python-bridge).
 *   SQL    (SQLite): editor on top, result table below; SELECT shows rows, other statements change the
 *                  selected dataset as a logged recipe step. Saved SQL scripts, dataset columns in the inspector.
 *   Regex: regular expressions tried on a column and applied as recipe steps (ui/analysis/regex-panel.js).
 *   Anteckningsbok: notebooks with text, R, Python and SQL cells (ui/analysis/notebook-panel.js); always last.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/modes/analysera', ['ui/base', 'data/r-bridge', 'data/python-bridge', 'data/recipes', 'presets', 'analysis/notebooks', 'ui/analysis/notebook-panel', 'ui/analysis/regex-panel', 'ui/analysis/text-panel', 'ui/analysis/images-panel', 'ui/analysis/geo-panel', 'ui/analysis/plan-panel', 'viz/leaflet'], (base, rb, pb, recipes, presets, notebooks, notebookPanel, regexPanelModule, textPanelModule, imagesPanelModule, geoPanelModule, planPanelModule, leaflet) => {
    const { h, t, i18n, replace } = base;
    /** The two code consoles share one implementation; these are their bridges and texts. */
    const bridges = { r: rb.bridge, python: pb.bridge };
    const CONSOLE = {
      r: { icon: 'terminal', title: 'analysera.title', status: 'analysera.status.', restart: 'analysera.restart', restarted: 'analysera.restarted', restartHint: 'analysera.restart.hint', stopHint: 'analysera.stop.hint', stopping: 'analysera.stopping', noSab: 'analysera.no.sab', outputEmpty: 'analysera.output.empty', placeholder: 'analysera.editor.placeholder', session: 'analysera.session', functions: 'analysera.functions', fn: 'analysera.fn.', datasetCreated: 'analysera.dataset.created', snippets: 'rSnippets', readSnippet: (name) => `df <- dm_read(${JSON.stringify(name)})\n`, prefix: 'R' },
      python: { icon: 'code', title: 'python.title', status: 'python.status.', restart: 'python.restart', restarted: 'python.restarted', restartHint: 'python.restart.hint', stopHint: 'python.stop.hint', stopping: 'python.stopping', noSab: 'python.no.sab', outputEmpty: 'python.output.empty', placeholder: 'python.editor.placeholder', session: 'python.session', functions: 'python.functions', fn: 'python.fn.', datasetCreated: 'python.dataset.created', snippets: 'pythonSnippets', readSnippet: (name) => `df = dm_read(${JSON.stringify(name)})\n`, prefix: 'Python' },
    };
    const CODE_LANGS = ['r', 'python'];
    /** R ships in the folder and starts when its tab opens; Python is fetched on the user's action (Start or Run). */
    const AUTOSTART = { r: true, python: false };
    const SCRIPT_LANGS = ['r', 'python', 'sql'];
    const SQL_LIMIT = 5000;
    const SQL_FUNCTIONS = ['regexp', 'regexp_replace', 'dm_parse_number', 'dm_parse_date', 'dm_fix_encoding', 'dm_title', 'dm_squish', 'dm_round', 'dm_pad', 'dm_date_part', 'dm_date_diff', 'dm_valid_id', 'dm_regex_test', 'dm_regex_extract', 'dm_regex_count', 'dm_regex_split'];
    const READ_ONLY_SQL = /^(select|with|values|pragma|explain)\b/i;

    function createMode(ctx) {
      const { ui, services, store, shell } = ctx;
      let slots = null; let unsubStore = null; const unsubBridges = [];
      let tab = 'r';
      /** Per-language editor state (scripts, current script, unsaved draft, live elements). */
      const consoleState = () => ({ scripts: [], current: { id: null, name: '', code: '' }, draft: '', editor: null, nameInput: null, outputEl: null, statusEl: null, runBtn: null, stopBtn: null, startBtn: null });
      const st = {
        r: consoleState(),
        python: consoleState(),
        sql: { scripts: [], current: { id: null, name: '', code: '' }, draft: '', editor: null, nameInput: null, target: 'local' },
      };
      let sqlOut = null; let sqlSaveBtn = null; let sqlResult = null; let sqlRunBtn = null; let sqlBadge = null;
      let nbList = []; let nbView = null; let notebook = null; let unsubNb = null;
      /** The Regex tab keeps its pattern and choices while the mode is open in other tabs. */
      let rxPanel = null;
      function regexPanel() {
        if (!rxPanel) {
          rxPanel = regexPanelModule.create(ctx, {
            openTab: (lang, code) => store.set({ pendingCode: { lang, code } }),
            rerender: () => { if (slots && tab === 'regex') { renderCenter(); renderRight(); } },
          });
        }
        return rxPanel;
      }
      /** Tools per dataset kind (after Regex, before the notebook): Text for documents, Bilder for image collections. */
      const KIND_TABS = { document: { id: 'text', label: 'analysera.tabs.text', icon: 'text-search' }, images: { id: 'images', label: 'analysera.tabs.images', icon: 'images' }, plan: { id: 'plan', label: 'analysera.tabs.plan', icon: 'layers' } };
      let txPanel = null; let imPanel = null; let plPanel = null; let tabsEl = null;
      function textPanel() { if (!txPanel) txPanel = textPanelModule.create(ctx, { rerenderRight: () => { if (slots && tab === 'text') renderRight(); } }); return txPanel; }
      function imagesPanel() { if (!imPanel) imPanel = imagesPanelModule.create(ctx, { rerenderRight: () => { if (slots && tab === 'images') renderRight(); } }); return imPanel; }
      function planPanel() { if (!plPanel) plPanel = planPanelModule.create(ctx, { rerenderRight: () => { if (slots && tab === 'plan') renderRight(); } }); return plPanel; }
      /** The Geo tab appears for tables with geometry or coordinates (checked when the selection changes). */
      let gPanel = null; let geoOk = false; let geoFor = '';
      function geoPanel() { if (!gPanel) gPanel = geoPanelModule.create(ctx, { rerenderRight: () => { if (slots && tab === 'geo') renderRight(); } }); return gPanel; }
      async function checkGeo() {
        const ds = selectedDataset();
        const key = ds ? ds.id + ':' + ds.updatedAt : '';
        if (key === geoFor) return;
        geoFor = key; geoOk = false;
        if (ds && (ds.kind === 'table' || !ds.kind)) {
          const cols = await services.datasets.columns(ds.id).catch(() => []);
          if (geoFor !== key) return;
          geoOk = leaflet.mappable(cols);
        }
        if (tabsEl) tabsEl.tabs = tabList();
      }
      const KIND_TAB_IDS = ['text', 'images', 'plan', 'geo'];
      const kindPanel = () => (tab === 'text' ? textPanel() : tab === 'images' ? imagesPanel() : tab === 'plan' ? planPanel() : tab === 'geo' ? geoPanel() : null);
      function tabList() {
        const ds = selectedDataset();
        const kind = ds && KIND_TABS[ds.kind] ? KIND_TABS[ds.kind] : null;
        // Fixed order: R, Python, SQL, Regex, then the kind tool; the notebook is always last because it joins pieces from the others.
        return [{ id: 'r', label: t('analysera.tabs.r'), icon: 'terminal' }, { id: 'python', label: t('analysera.tabs.python'), icon: 'code' }, { id: 'sql', label: t('analysera.tabs.sql'), icon: 'database' }, { id: 'regex', label: t('analysera.tabs.regex'), icon: 'regex' }]
          .concat(kind ? [{ id: kind.id, label: t(kind.label), icon: kind.icon }] : (tab === 'text' || tab === 'images' || tab === 'plan') ? [{ id: tab, label: t(KIND_TABS[tab === 'text' ? 'document' : tab].label), icon: KIND_TABS[tab === 'text' ? 'document' : tab].icon }] : [])
          .concat(geoOk || tab === 'geo' ? [{ id: 'geo', label: t('analysera.tabs.geo'), icon: 'map' }] : [])
          .concat([{ id: 'notebook', label: t('analysera.tabs.notebook'), icon: 'file-text' }]);
      }

      function activate(s) {
        slots = s;
        unsubStore = store.subscribe((state, changed) => {
          if (changed.includes('pendingCode')) takePending();
          if (!changed.includes('datasets') && !changed.includes('selectedId')) return;
          renderLeft();
          checkGeo();
          if (tabsEl) tabsEl.tabs = tabList();
          if (tab === 'sql') { updateSqlHead(); if (changed.includes('selectedId')) renderRight(); }
          if (tab === 'notebook' && changed.includes('datasets')) renderRight();
          if (tab === 'regex') { regexPanel().datasetChanged(); if (changed.includes('selectedId')) { renderCenter(); renderRight(); } }
          if (KIND_TAB_IDS.includes(tab)) { kindPanel().datasetChanged(); if (changed.includes('selectedId')) { renderCenter(); renderRight(); } }
        });
        for (const lang of CODE_LANGS) unsubBridges.push(bridges[lang].on((type, payload) => onBridgeEvent(lang, type, payload)));
        unsubNb = notebooks.subscribe(async () => { nbList = await notebooks.list(); if (tab === 'notebook') renderLeft(); });
        render();
        for (const lang of SCRIPT_LANGS) services.idb.listScripts(lang).then((list) => { st[lang].scripts = list; renderLeft(); });
        notebooks.list().then((list) => { nbList = list; renderLeft(); });
        if (AUTOSTART[tab]) startEngine(tab);
        takePending();
      }
      function deactivate() {
        for (const lang of SCRIPT_LANGS) { const v = st[lang]; if (v.editor) v.draft = v.editor.value; v.editor = null; v.nameInput = null; }
        for (const lang of CODE_LANGS) { const v = st[lang]; v.outputEl = null; v.statusEl = null; v.runBtn = null; v.stopBtn = null; v.startBtn = null; }
        if (nbView) { notebook = nbView.notebook; nbView.destroy(); nbView = null; }
        if (rxPanel) rxPanel.destroy();
        if (txPanel) txPanel.destroy();
        if (imPanel) imPanel.destroy();
        if (gPanel) gPanel.destroy();
        slots = null; tabsEl = null; sqlOut = null; sqlSaveBtn = null; sqlRunBtn = null; sqlBadge = null;
        if (unsubStore) unsubStore();
        while (unsubBridges.length) unsubBridges.pop()();
        if (unsubNb) unsubNb();
      }

      // ---- notebooks ----
      async function newNotebook() {
        const name = await ui.dialog.prompt(t('nb.new.prompt'), { title: t('nb.new'), value: '' });
        if (!name || !name.trim()) return;
        const saved = await notebooks.save(notebooks.create(name.trim(), selectedDataset()));
        shell.log(t('nb.saved', { name: saved.name }), 'ok');
        openNotebook(saved);
      }
      function openNotebook(record) {
        notebook = record; tab = 'notebook';
        renderCenter(); renderLeft(); renderRight();
      }
      async function importNotebook() {
        const [file] = await services.files.pick({ accept: '.json' });
        if (!file) return;
        try { const nb = await notebooks.importJson(await file.text()); shell.log(t('nb.imported', { name: nb.name }), 'ok'); openNotebook(nb); } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }
      function renderNotebookLeft() {
        slots.left.appendChild(h('hr'));
        slots.left.appendChild(h('div', { class: 'dm-row' }, h('h4', { class: 'dm-grow', text: t('nb.title') }), ui.button({ label: t('nb.new'), icon: 'plus', size: 'sm', 'icon-only': true, variant: 'ghost', onClick: newNotebook })));
        slots.left.appendChild(h('div', { class: 'dm-list' }, nbList.map((n) => h('button', { type: 'button', class: 'dm-list-item', 'aria-current': notebook && notebook.id === n.id ? 'true' : null, onclick: () => openNotebook(n) },
          ui.icon('file-text', 16), h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: n.name }), h('span', { class: 'dm-list-sub dm-truncate', text: [t('nb.cells', { n: (n.cells || []).length }), n.datasetName].filter(Boolean).join(' · ') }))))));
        slots.left.appendChild(h('div', { class: 'dm-row' }, ui.button({ label: t('nb.import'), icon: 'upload', size: 'sm', onClick: importNotebook })));
      }
      function renderNotebook() {
        if (nbView) { nbView.destroy(); nbView = null; }
        if (!notebook) {
          const head = h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon('file-text', 20), t('nb.title')));
          return { head, body: h('dm-empty-state', { icon: 'file-text', heading: t('nb.title'), text: t('nb.empty') }, ui.button({ label: t('nb.new'), icon: 'plus', variant: 'primary', onClick: newNotebook })) };
        }
        nbView = notebookPanel.create(ctx, { notebook, onDeleted: () => { notebook = null; renderCenter(); renderLeft(); renderRight(); }, onSaved: (saved) => { notebook = saved; }, log: (m, k) => shell.log(m, k) });
        nbView.start();
        return { head: nbView.headEl, body: nbView.bodyEl };
      }
      /** Start a console's engine when its tab opens; a failure is shown in the log and the badge. */
      function startEngine(lang) { bridges[lang].start().catch((err) => shell.log(CONSOLE[lang].prefix + ': ' + ((err && err.message) || err), 'error')); }
      /** Code handed over through the store (the beginner's course, the Regex tab): added to its tab's editor and optionally run. */
      function takePending() {
        const p = store.get().pendingCode;
        if (!p || !st[p.lang] || !slots) return;
        store.set({ pendingCode: null });
        const v = st[tab]; if (v && v.editor) v.draft = v.editor.value;
        const target = st[p.lang];
        const existing = (target.draft || target.current.code || '').trim();
        if (!existing.includes(p.code.trim())) target.draft = existing ? existing + '\n\n' + p.code : p.code;
        tab = p.lang;
        render();
        if (AUTOSTART[tab]) startEngine(tab);
        if (p.run) { if (tab === 'sql') runSql({ code: p.code }); else run(tab, { code: p.code }); }
      }
      function selectedDataset() { const state = store.get(); return state.datasets.find((d) => d.id === state.selectedId) || null; }

      function onBridgeEvent(lang, type, payload) {
        if (type === 'state' || type === 'progress') updateStatus(lang);
        // webR's canvas device sends drawing batches while a command runs; show them at once.
        if (type === 'plot' && payload.key === null && st[lang].outputEl) appendEntries(lang, [{ kind: 'plot', canvas: payload.canvas, key: null }]);
        if (type === 'state' && payload.state === 'ready' && tab === lang) renderRight();
      }

      function render() { if (!slots) return; checkGeo(); renderLeft(); renderCenter(); renderRight(); }

      // ---- left: datasets and scripts of the active language ----
      function renderLeft() {
        if (!slots) return;
        const state = store.get();
        const v = st[tab];
        ui.datasetList.render(slots.left, { datasets: state.datasets, selectedId: state.selectedId, onSelect: (id) => store.set({ selectedId: id }) });
        if (tab === 'notebook') { renderNotebookLeft(); return; }
        if (tab === 'regex') { regexPanel().left(slots.left, renderLeft); return; }
        if (KIND_TAB_IDS.includes(tab)) return;
        const selected = selectedDataset();
        if (CONSOLE[tab]) slots.left.appendChild(h('div', { class: 'dm-row' }, ui.button({ label: t('analysera.insert.read'), icon: 'braces', size: 'sm', disabled: !selected, onClick: () => selected && insertCode(tab, CONSOLE[tab].readSnippet(selected.shortName || selected.name)) })));
        slots.left.appendChild(h('hr'));
        slots.left.appendChild(h('div', { class: 'dm-row' }, h('h4', { class: 'dm-grow', text: t('analysera.scripts.' + tab) }), ui.button({ label: t('analysera.new.script'), icon: 'plus', size: 'sm', 'icon-only': true, variant: 'ghost', onClick: () => newScript(tab) })));
        slots.left.appendChild(h('div', { class: 'dm-list' }, v.scripts.map((sc) => h('button', { type: 'button', class: 'dm-list-item', 'aria-current': sc.id === v.current.id ? 'true' : null, onclick: () => openScript(tab, sc) },
          ui.icon('file-text', 16), h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: sc.name }), h('span', { class: 'dm-list-sub', text: i18n.formatDateTime(sc.updatedAt) }))))));
      }

      function insertCode(lang, code) { const v = st[lang]; if (v.editor) v.editor.insert(code); }

      function newScript(lang) {
        const v = st[lang];
        v.draft = '';
        v.current = { id: null, name: '', code: '' };
        renderCenter(); renderLeft();
        if (v.editor) v.editor.focus();
      }
      function openScript(lang, sc) {
        const v = st[lang];
        v.current = { id: sc.id, name: sc.name, code: sc.code, createdAt: sc.createdAt };
        v.draft = sc.code;
        renderCenter(); renderLeft();
      }
      async function saveScript(lang) {
        const v = st[lang];
        const code = v.editor ? v.editor.value : v.draft;
        let name = v.nameInput ? v.nameInput.value.trim() : v.current.name;
        if (!name) {
          name = await ui.dialog.prompt(t('analysera.script.name'), { title: t('analysera.save'), value: v.current.name || t('analysera.script.untitled') });
          if (!name) return;
          if (v.nameInput) v.nameInput.value = name;
        }
        const now = new Date().toISOString();
        const record = { id: v.current.id || ('sc_' + Date.now().toString(36)), name, language: lang, code, updatedAt: now, createdAt: v.current.createdAt || now };
        await services.idb.putScript(record);
        v.current = { id: record.id, name: record.name, code, createdAt: record.createdAt };
        v.scripts = await services.idb.listScripts(lang);
        renderLeft();
        shell.log(t('analysera.saved', { name }), 'ok');
        ui.toast.show(t('analysera.saved', { name }), { kind: 'ok' });
      }
      async function deleteScript(lang) {
        const v = st[lang];
        if (!v.current.id) return;
        if (!(await ui.dialog.confirm(t('analysera.delete.confirm', { name: v.current.name }), { okLabel: t('common.delete'), danger: true }))) return;
        await services.idb.deleteScript(v.current.id);
        v.scripts = await services.idb.listScripts(lang);
        shell.log(t('analysera.deleted'), 'ok');
        newScript(lang);
      }

      // ---- centre: tabs plus the active console ----
      function renderCenter() {
        if (!slots) return;
        const tabs = /** @type {any} */ (h('dm-tabs'));
        tabs.tabs = tabList();
        tabs.active = tab;
        tabsEl = tabs;
        tabs.addEventListener('dm-change', (e) => {
          const v = st[tab]; if (v && v.editor) v.draft = v.editor.value;
          if (nbView) { notebook = nbView.notebook; }
          tab = /** @type {any} */ (e).detail.id;
          renderCenter(); renderLeft(); renderRight();
          if (AUTOSTART[tab]) startEngine(tab);
        });
        if (tab !== 'notebook' && nbView) { notebook = nbView.notebook; nbView.destroy(); nbView = null; }
        const view = CONSOLE[tab] ? renderConsole(tab) : tab === 'sql' ? renderSql() : tab === 'regex' ? regexPanel().center() : KIND_TAB_IDS.includes(tab) ? kindPanel().center() : renderNotebook();
        replace(slots.center, view.head, tabs, view.body);
      }

      /** The R and Python consoles: editor, run/stop/save/clear/restart, output with plots. */
      function renderConsole(lang) {
        const v = st[lang];
        const bridge = bridges[lang];
        const text = CONSOLE[lang];
        v.statusEl = h('dm-badge', { text: '' });
        v.runBtn = ui.button({ label: t('analysera.run'), icon: 'play', variant: 'primary', title: t('analysera.run.hint'), onClick: () => run(lang) });
        // Running code can be stopped when the page is cross-origin isolated (served from a web server); on file://
        // only a restart helps.
        v.stopBtn = bridge.canInterrupt ? ui.button({ label: t('analysera.stop'), icon: 'square', title: t(text.stopHint), onClick: () => { if (bridge.interrupt()) shell.log(t(text.stopping)); } }) : null;
        v.nameInput = /** @type {any} */ (h('dm-input', { placeholder: t('analysera.script.untitled'), 'aria-label': t('analysera.script.name'), inline: true }));
        v.nameInput.value = v.current.name;
        v.editor = /** @type {any} */ (h('dm-code', { language: lang, placeholder: t(text.placeholder) }));
        v.editor.value = v.draft || v.current.code;
        v.editor.addEventListener('dm-run', (e) => run(lang, /** @type {any} */ (e).detail));
        v.editor.addEventListener('dm-change', () => { v.draft = v.editor.value; });
        v.outputEl = v.outputEl || h('div', { class: 'dm-console', role: 'log', 'aria-live': 'polite' }, h('p', { class: 'dm-help dm-console-empty', text: t(text.outputEmpty) }));
        // An engine that is not started automatically gets a Start button (Run starts it too); hidden once started.
        v.startBtn = AUTOSTART[lang] ? null : ui.button({ label: t('python.start'), icon: 'download', title: t('python.start.hint'), onClick: () => startEngine(lang) });
        const head = h('div', { class: 'dm-page-head' },
          h('h1', null, ui.icon(text.icon, 20), t(text.title), ' ', v.statusEl),
          h('div', { class: 'dm-row' },
            v.runBtn,
            v.startBtn,
            v.stopBtn,
            ui.button({ label: t('analysera.save'), icon: 'save', onClick: () => saveScript(lang) }),
            v.current.id ? ui.button({ label: t('common.delete'), icon: 'trash-2', variant: 'ghost', 'icon-only': true, onClick: () => deleteScript(lang) }) : null,
            ui.button({ label: t('analysera.clear'), icon: 'x', variant: 'ghost', onClick: () => clearOutput(lang) }),
            ui.button({ label: t(text.restart), icon: 'refresh-cw', variant: 'ghost', title: bridge.canInterrupt ? undefined : t(text.restartHint), onClick: () => restart(lang) })));
        updateStatus(lang);
        return { head, body: [h('div', { class: 'dm-row' }, v.nameInput, h('span', { class: 'dm-help', text: t('analysera.run.hint') })), h('div', { class: 'dm-editor-wrap' }, v.editor), v.outputEl] };
      }

      function updateStatus(lang) {
        const v = st[lang];
        const bridge = bridges[lang];
        if (!v.statusEl) return;
        const map = { idle: ['idle', ''], starting: ['starting', 'accent'], ready: ['ready', 'ok'], busy: ['busy', 'accent'], error: ['error', 'error'] };
        const [key, kind] = map[bridge.state] || map.idle;
        let label = t(CONSOLE[lang].status + key);
        // Python is downloaded the first time: show how far the components have come.
        if (bridge.state === 'starting' && bridge.progress && bridge.progress.total) label = t('python.status.downloading', { pct: Math.min(99, Math.round(100 * bridge.progress.received / bridge.progress.total)) });
        v.statusEl.textContent = label;
        if (kind) v.statusEl.setAttribute('kind', kind); else v.statusEl.removeAttribute('kind');
        if (v.runBtn) { v.runBtn.disabled = bridge.state === 'busy' || bridge.state === 'starting'; v.runBtn.loading = bridge.state === 'busy'; }
        if (v.stopBtn) v.stopBtn.disabled = bridge.state !== 'busy';
        if (v.startBtn) v.startBtn.hidden = !(bridge.state === 'idle' || bridge.state === 'error');
      }

      async function run(lang, detail) {
        const v = st[lang];
        const editor = v.editor;
        if (!editor) return;
        const selection = detail && detail.selection && editor.cm && editor.cm.somethingSelected() ? detail.selection : '';
        const code = ((detail && detail.code) || selection || editor.value).trim();
        if (!code) return;
        v.draft = editor.value;
        const empty = v.outputEl.querySelector('.dm-console-empty');
        if (empty) empty.remove();
        try {
          const res = await bridges[lang].run(code);
          appendEntries(lang, res.entries);
          appendEntries(lang, [{ kind: 'meta', text: t('analysera.took', { ms: i18n.formatNumber(Math.round(res.ms)) }) }]);
          for (const e of res.entries) if (e.kind === 'dataset') { shell.log(t(CONSOLE[lang].datasetCreated, { name: e.meta.name, rows: i18n.formatNumber(e.meta.rowCount) }), 'ok'); }
          store.set({ lastRun: { lang, at: Date.now(), ok: !res.entries.some((e) => e.kind === 'error') } });
        } catch (err) {
          appendEntries(lang, [{ kind: 'error', text: (err && err.message) || String(err) }]);
        }
      }

      function clearOutput(lang) { const v = st[lang]; if (v.outputEl) replace(v.outputEl, h('p', { class: 'dm-help dm-console-empty', text: t(CONSOLE[lang].outputEmpty) })); }

      async function restart(lang) {
        try { await bridges[lang].restart(); shell.log(t(CONSOLE[lang].restarted), 'ok'); } catch (err) { shell.log(CONSOLE[lang].prefix + ': ' + ((err && err.message) || err), 'error'); }
      }

      function appendEntries(lang, entries) {
        const outputEl = st[lang].outputEl;
        if (!outputEl) return;
        for (const e of entries) {
          let node;
          if (e.kind === 'input') node = h('pre', { class: 'dm-console-input', text: e.text });
          else if (e.kind === 'stdout') node = h('pre', { class: 'dm-console-stdout', text: e.text });
          else if (e.kind === 'stderr') node = h('pre', { class: 'dm-console-stderr', text: e.text });
          else if (e.kind === 'error') node = h('pre', { class: 'dm-console-error', text: e.text });
          else if (e.kind === 'meta') node = h('div', { class: 'dm-console-meta', text: e.text });
          else if (e.kind === 'packages') node = h('div', { class: 'dm-console-meta', text: t('analysera.packages.installed', { names: e.names.join(', ') }) });
          else if (e.kind === 'plot') node = plotEntry(lang, e);
          else if (e.kind === 'dataset') node = h('div', { class: 'dm-console-dataset' }, ui.icon('table', 14), h('span', { text: t(CONSOLE[lang].datasetCreated, { name: e.meta.name, rows: i18n.formatNumber(e.meta.rowCount) }) }), ui.button({ label: t('analysera.open.bearbeta'), size: 'sm', onClick: () => { store.set({ selectedId: e.meta.id }); shell.activate('bearbeta'); } }));
          if (node) outputEl.appendChild(node);
        }
        outputEl.scrollTop = outputEl.scrollHeight;
      }

      /** A plot: R gives a canvas, Python an SVG (shown) and a PNG (for notebooks); both export through their bridge. */
      function plotEntry(lang, e) {
        let image;
        if (e.canvas) { image = e.canvas; image.classList.add('dm-console-plot'); }
        else if (e.plotly) {
          // A plotly figure from Python is drawn by plotly.js (a component fetched on first use) once the node is attached.
          image = h('div', { class: 'dm-console-plot dm-plotly', style: { height: (e.height || 480) + 'px' } });
          Promise.resolve().then(() => D.require('viz/plotly').render(image, e.plotly)).catch((err) => replace(image, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) })));
        } else {
          image = h('img', { class: 'dm-console-plot', alt: '', width: String(e.width || 672), height: String(e.height || 480) });
          image.src = e.svg ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(e.svg) : 'data:image/png;base64,' + (e.png || '');
        }
        const tools = e.key ? h('div', { class: 'dm-row' }, ['svg', 'png', 'pdf'].map((fmt) => ui.button({ label: t('analysera.plot.export', { format: fmt.toUpperCase() }), size: 'sm', icon: 'download', onClick: () => exportPlot(lang, e.key, fmt) }))) : null;
        return h('figure', { class: 'dm-console-figure' }, image, tools);
      }

      async function exportPlot(lang, key, format) {
        try {
          const blob = await bridges[lang].exportPlot(key, format);
          const name = services.files.safeName(`dataspatium-diagram-${key}`, format);
          services.files.download(blob, name);
          shell.log(t('analysera.plot.exported', { name }), 'ok');
        } catch (err) { shell.log(CONSOLE[lang].prefix + ': ' + ((err && err.message) || err), 'error'); ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }

      // ---- SQL console ----
      function renderSql() {
        const v = st.sql;
        sqlRunBtn = ui.button({ label: t('sql.run'), icon: 'play', variant: 'primary', title: t('analysera.run.hint'), onClick: () => runSql() });
        sqlBadge = h('dm-badge', { text: '' });
        sqlSaveBtn = ui.button({ label: t('sql.save.dataset'), icon: 'table', disabled: !(sqlResult && sqlResult.sql), onClick: saveSqlResult });
        // Where the SQL runs: the datasets here (SQLite) or the source last opened in the database bridge.
        const bridgeSource = D.require('api/bridge').getCurrent();
        if (!bridgeSource) v.target = 'local';
        const sqlTarget = /** @type {any} */ (h('dm-select', { 'aria-label': t('sql.target'), inline: true }));
        sqlTarget.options = [{ value: 'local', label: t('sql.target.local') }].concat(bridgeSource ? [{ value: 'bridge', label: t('sql.target.bridge', { name: D.require('api/bridge').sourceLabel(bridgeSource) }) }] : []);
        sqlTarget.value = v.target || 'local';
        sqlTarget.addEventListener('change', () => { v.target = sqlTarget.value; updateSqlHead(); });
        sqlTarget.hidden = !bridgeSource;
        updateSqlHead();
        v.nameInput = /** @type {any} */ (h('dm-input', { placeholder: t('analysera.script.untitled'), 'aria-label': t('analysera.script.name'), inline: true }));
        v.nameInput.value = v.current.name;
        v.editor = /** @type {any} */ (h('dm-code', { language: 'sql', placeholder: t('sql.editor.placeholder') }));
        v.editor.value = v.draft || v.current.code;
        v.editor.addEventListener('dm-run', (e) => runSql(/** @type {any} */ (e).detail));
        v.editor.addEventListener('dm-change', () => { v.draft = v.editor.value; });
        sqlOut = h('div', { class: 'dm-sql-result dm-center-fill' });
        const head = h('div', { class: 'dm-page-head' },
          h('h1', null, ui.icon('database', 20), t('sql.title'), ' ', sqlBadge),
          h('div', { class: 'dm-row' },
            sqlRunBtn,
            sqlTarget,
            ui.button({ label: t('analysera.save'), icon: 'save', onClick: () => saveScript('sql') }),
            v.current.id ? ui.button({ label: t('common.delete'), icon: 'trash-2', variant: 'ghost', 'icon-only': true, onClick: () => deleteScript('sql') }) : null,
            sqlSaveBtn));
        renderSqlResult();
        return { head, body: [h('div', { class: 'dm-row' }, v.nameInput, h('span', { class: 'dm-help', text: t('sql.hint') })), h('div', { class: 'dm-editor-wrap' }, v.editor), sqlOut] };
      }

      /** Badge with the selected dataset and run-button state; cheap enough to call on every store change. */
      function updateSqlHead() {
        const ds = selectedDataset();
        if (sqlBadge) { sqlBadge.textContent = ds ? ds.name : t('sql.no.dataset'); if (ds) sqlBadge.removeAttribute('kind'); else sqlBadge.setAttribute('kind', 'warn'); }
        if (sqlRunBtn) sqlRunBtn.disabled = !ds && st.sql.target !== 'bridge';
      }

      async function runSql(detail) {
        const editor = st.sql.editor;
        if (!editor) return;
        const ds = selectedDataset();
        const bridge = D.require('api/bridge');
        const viaBridge = st.sql.target === 'bridge' ? bridge.getCurrent() : null;
        if (!ds && !viaBridge) { ui.toast.show(t('sql.no.dataset'), { kind: 'warn' }); return; }
        const selection = detail && detail.selection && editor.cm && editor.cm.somethingSelected() ? detail.selection : '';
        const code = ((detail && detail.code) || selection || editor.value).trim().replace(/;\s*$/, '');
        if (!code) return;
        st.sql.draft = editor.value;
        const t0 = performance.now();
        try {
          if (viaBridge) {
            sqlResult = await runBridgeSql(bridge, viaBridge, code, t0);
          } else if (READ_ONLY_SQL.test(code)) {
            // Other datasets named by their short names are attached for the query (joins across datasets).
            const r = await D.require('data/query').select(ds.id, code, { limit: SQL_LIMIT });
            sqlResult = { sql: code, datasetId: ds.id, columns: r.columns, values: r.values, truncated: r.truncated, ms: performance.now() - t0, sorted: null, others: r.others };
          } else {
            const result = await recipes.apply(ds.id, 'sql', { statement: code });
            sqlResult = { message: t('sql.changed', { n: i18n.formatNumber(result.rows || 0) }) };
            shell.log(recipes.describe('sql', { statement: code }, result), 'ok');
          }
          store.set({ lastRun: { lang: 'sql', at: Date.now(), ok: true } });
        } catch (err) {
          sqlResult = { error: t('sql.error', { message: (err && err.message) || String(err) }) };
        }
        renderSqlResult();
      }

      /** SQL against the database bridge's current source: SELECT shows rows; other statements are approved first. */
      async function runBridgeSql(bridge, source, code, t0) {
        const shape = (r) => ({ sql: code, datasetId: null, bridge: source, columns: r.columns.map((c) => c.name), values: r.rows, truncated: !!r.truncated, ms: performance.now() - t0, sorted: null });
        try {
          const r = await bridge.query(source, code, { limit: SQL_LIMIT });
          if (r.affected !== undefined) return { message: t('bridge.sql.affected', { n: i18n.formatNumber(r.affected) }) };
          return shape(r);
        } catch (err) {
          if (!err || err.status !== 428) throw err;
          const ok = await ui.dialog.open({
            title: t('bridge.approve.title'),
            body: h('div', { class: 'dm-stack-sm' }, h('p', { text: t('bridge.approve.text', { name: bridge.sourceLabel(source) }) }), h('pre', { class: 'dm-help-code', text: code })),
            actions: [{ label: t('common.cancel'), value: false }, { label: t('bridge.approve.ok'), variant: 'primary', value: true, primary: true }],
          });
          if (ok !== true) return { message: t('bridge.approve.cancelled') };
          const r = await bridge.query(source, code, { limit: SQL_LIMIT, approved: true });
          const text = t('bridge.sql.affected', { n: i18n.formatNumber(r.affected || 0) });
          shell.log(text, 'ok');
          return { message: text };
        }
      }
      function renderSqlResult() {
        if (!sqlOut) return;
        if (sqlSaveBtn) sqlSaveBtn.disabled = !(sqlResult && sqlResult.sql && sqlResult.columns.length);
        if (!sqlResult) { replace(sqlOut, h('p', { class: 'dm-help dm-console-empty', text: t('sql.empty') })); return; }
        if (sqlResult.error) { replace(sqlOut, h('pre', { class: 'dm-console-error', text: sqlResult.error })); return; }
        if (sqlResult.message) { replace(sqlOut, h('div', { class: 'dm-console-dataset' }, ui.icon('circle-check', 14), h('span', { text: sqlResult.message }))); return; }
        const result = sqlResult;
        const table = /** @type {any} */ (h('dm-table'));
        table.setData({
          columns: result.columns.map((name, i) => ({ key: name, label: name, type: guessType(result.values, i) })),
          rowCount: result.values.length,
          rowProvider: async (start, count, sort) => sortedRows(result, sort).slice(start, start + count),
        });
        replace(sqlOut,
          h('div', { class: 'dm-row' },
            h('span', { class: 'dm-help', text: t('sql.result', { n: i18n.formatNumber(result.values.length), ms: i18n.formatNumber(Math.round(result.ms)) }) }),
            result.truncated ? h('span', { class: 'dm-warn dm-small', text: t('sql.result.truncated', { n: i18n.formatNumber(SQL_LIMIT) }) }) : null),
          h('div', { class: 'dm-table-wrap dm-center-fill' }, table));
      }

      /** Sort an in-memory result (cached per sort key) for the result table's header clicks. */
      function sortedRows(result, sort) {
        if (!sort) return result.values;
        if (result.sorted && result.sorted.key === sort.key && result.sorted.dir === sort.dir) return result.sorted.rows;
        const i = result.columns.indexOf(sort.key);
        const dir = sort.dir === 'desc' ? -1 : 1;
        const rows = result.values.slice().sort((a, b) => {
          const x = a[i]; const y = b[i];
          if (x === null || x === undefined) return y === null || y === undefined ? 0 : 1;
          if (y === null || y === undefined) return -1;
          if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
          return String(x).localeCompare(String(y), 'sv') * dir;
        });
        result.sorted = { key: sort.key, dir: sort.dir, rows };
        return rows;
      }

      function guessType(values, i) {
        let n = 0; let num = 0; let int = 0;
        for (let r = 0; r < values.length && r < 200; r++) {
          const v = values[r][i];
          if (v === null || v === undefined) continue;
          n++;
          if (typeof v === 'number') { num++; if (Number.isInteger(v)) int++; }
        }
        if (n && num === n) return int === n ? 'integer' : 'number';
        return 'text';
      }

      async function saveSqlResult() {
        if (!sqlResult || !sqlResult.sql) return;
        const name = await ui.dialog.prompt(t('sql.dataset.name'), { title: t('sql.save.dataset'), value: t('sql.dataset.default') });
        if (!name || !name.trim()) return;
        try {
          const meta = sqlResult.bridge
            ? await D.require('api/bridge').importTable(sqlResult.bridge, { sql: sqlResult.sql, name: name.trim() })
            : await D.require('data/query').createDataset(sqlResult.datasetId, sqlResult.sql, { name: name.trim(), source: { kind: 'sql', from: sqlResult.datasetId, sql: sqlResult.sql } });
          const text = t('derive.created', { name: meta.name, rows: i18n.formatNumber(meta.rowCount) });
          shell.log(text, 'ok');
          ui.toast.show(text, { kind: 'ok', action: { label: t('analysera.open.bearbeta'), onClick: () => { store.set({ selectedId: meta.id }); shell.activate('bearbeta'); } } });
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
      }

      // ---- right: session info and snippets (R, Python) or schema and functions (SQL) ----
      async function renderRight() {
        if (!slots) return;
        if (tab === 'notebook') { replace(slots.right, nbView ? nbView.inspector() : h('p', { class: 'dm-help', text: t('nb.help') })); return; }
        if (tab === 'regex') { replace(slots.right, regexPanel().inspector()); return; }
        if (KIND_TAB_IDS.includes(tab)) { replace(slots.right, kindPanel().inspector()); return; }
        if (tab === 'sql') {
          const ds = selectedDataset();
          let cols = [];
          // The dataset may be removed while we wait; show the panel without columns in that case.
          try { cols = ds ? await services.datasets.columns(ds.id) : []; } catch (_err) { cols = []; }
          if (!slots || tab !== 'sql') return;
          const quote = (name) => (/^[a-z_][a-z0-9_]*$/i.test(name) ? name : '"' + name.replace(/"/g, '""') + '"');
          // Every dataset by short name: click to insert, so that joins across datasets are a few clicks away.
          const all = store.get().datasets;
          replace(slots.right,
            h('h4', { text: t('sql.columns') }),
            ds ? h('div', { class: 'dm-list' }, cols.map((c) => h('button', { type: 'button', class: 'dm-list-item', onclick: () => insertCode('sql', quote(c.name)) },
              ui.icon('columns-3', 14), h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: c.name }), h('span', { class: 'dm-list-sub', text: t('type.' + c.type) })))))
              : h('p', { class: 'dm-help', text: t('sql.no.dataset') }),
            h('h4', { text: t('sql.shortnames') }),
            h('p', { class: 'dm-help', text: t('sql.shortnames.hint') }),
            h('div', { class: 'dm-list' }, all.map((d) => h('button', { type: 'button', class: 'dm-list-item', 'aria-current': ds && d.id === ds.id ? 'true' : null, title: d.name, onclick: () => insertCode('sql', d.shortName || '') },
              ui.icon('table', 14), h('span', { class: 'dm-list-main' }, h('code', { class: 'dm-list-code dm-truncate', text: d.shortName || '' }), h('span', { class: 'dm-list-sub dm-truncate', text: d.name }))))),
            h('h4', { text: t('sql.functions') }), h('ul', { class: 'dm-stack-sm' }, SQL_FUNCTIONS.map((f) => h('li', { class: 'dm-small', text: t('sql.fn.' + f) }))));
          return;
        }
        const lang = CONSOLE[tab] ? tab : 'r';
        const bridge = bridges[lang];
        const text = CONSOLE[lang];
        const kv = /** @type {any} */ (h('dm-kv'));
        const packageCount = lang === 'r' ? D.require('engines/r/packages').all().length : D.require('engines/python/catalog').all().length;
        kv.items = [
          { label: t('analysera.session.version'), value: bridge.version || '–' },
          { label: t('analysera.session.startup'), value: bridge.startupMs ? i18n.formatNumber(Math.round(bridge.startupMs)) + ' ms' : '–' },
          { label: t('analysera.session.mirrored'), value: String(bridge.mirrored.size) },
          { label: t(lang === 'r' ? 'analysera.session.packages' : 'python.session.packages'), value: packageCount ? String(packageCount) : '–' },
        ];
        const fns = ['dm_list', 'dm_read', 'dm_write', 'theme'].map((k) => h('li', { class: 'dm-small', text: t(text.fn + k) }));
        const snippets = h('div', { class: 'dm-list' }, (presets[text.snippets] || []).map((sn) => h('button', { type: 'button', class: 'dm-list-item', onclick: () => insertCode(lang, sn.code + '\n') }, ui.icon('braces', 14), h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: t(sn.labelKey) })))));
        replace(slots.right,
          h('h4', { text: t(text.session) }), kv,
          bridge.state === 'error' && bridge.error ? h('p', { class: 'dm-error dm-small', text: bridge.error }) : null,
          lang === 'python' ? h('p', { class: 'dm-help', text: t('python.components.hint') }) : null,
          h('p', { class: 'dm-help', text: t(text.noSab) }),
          h('h4', { text: t(text.functions) }), h('ul', { class: 'dm-stack-sm' }, fns),
          h('h4', { text: t('analysera.snippets') }), snippets);
      }

      // Command palette: the consoles and every notebook.
      if (ctx.palette) {
        ctx.palette.register(async () => {
          const cmds = [
            { id: 'analysera:r', label: t('palette.analyze.r'), group: t('palette.group.modes'), icon: 'terminal', run: () => { tab = 'r'; shell.activate('analysera'); } },
            { id: 'analysera:python', label: t('palette.analyze.python'), group: t('palette.group.modes'), icon: 'code', run: () => { tab = 'python'; shell.activate('analysera'); } },
            { id: 'analysera:sql', label: t('palette.analyze.sql'), group: t('palette.group.modes'), icon: 'database', run: () => { tab = 'sql'; shell.activate('analysera'); } },
            { id: 'analysera:regex', label: t('palette.analyze.regex'), group: t('palette.group.modes'), icon: 'regex', run: () => { tab = 'regex'; shell.activate('analysera'); } },
            { id: 'nb:new', label: t('nb.new'), group: t('palette.group.notebooks'), icon: 'plus', run: async () => { shell.activate('analysera'); await newNotebook(); } },
          ];
          for (const n of await notebooks.list()) cmds.push({ id: 'nb:' + n.id, label: t('palette.nb.open', { name: n.name }), hint: n.datasetName || '', group: t('palette.group.notebooks'), icon: 'file-text', run: () => { notebook = n; tab = 'notebook'; shell.activate('analysera'); if (slots) render(); } });
          return cmds;
        });
      }

      return { id: 'analysera', activate, deactivate, get sqlTarget() { return st.sql.target; }, setSqlTarget(v) { st.sql.target = v; if (slots && tab === 'sql') render(); } };
    }
    return { createMode };
  });
})();
