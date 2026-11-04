// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Application shell: builds the fixed layout (top bar with the eight modes, object panel, workspace,
 * inspector, log drawer, status bar), owns the store and hands each mode the same slots and services.
 *
 * Mode contract: { id, activate(slots), deactivate(), update?(state, changed) } created by
 * `createMode(ctx)` in src/ui/modes/*.js.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/shell', ['ui/components', 'ui/base', 'ui/icons', 'ui/basic', 'ui/overlays', 'ui/theme', 'ui/state', 'ui/dataset-list', 'data/datasets', 'data/workspace', 'io/import', 'io/export', 'platform/files', 'platform/storage/idb', 'ui/command-palette', 'ui/course', 'data/r-bridge', 'data/python-bridge'],
    (_components, base, icons, basic, overlays, theme, stateMod, datasetList, datasets, workspace, importer, exporter, files, idb, paletteMod, courseMod, rBridge, pyBridge) => {
      const { h, t, i18n, replace } = base;
      const MODES = ['inhamta', 'hantera', 'soka', 'bearbeta', 'analysera', 'visualisera', 'exportera', 'dela'];
      const MODE_ICONS = { inhamta: 'download', hantera: 'database', soka: 'text-search', bearbeta: 'wand-sparkles', analysera: 'terminal', visualisera: 'chart-column', exportera: 'file-output', dela: 'share-2' };
      const THEME_ICON = { auto: 'sun', light: 'sun', dark: 'moon' };
      const ENGINE_STATES = { idle: 'shell.engine.state.idle', starting: 'shell.engine.state.starting', ready: 'shell.engine.state.ready', busy: 'shell.engine.state.busy', error: 'shell.engine.state.error' };
      /** Settings keys for the panel widths set with the splitters. */
      const WIDTH_SETTINGS = { left: 'ui.panel.left', right: 'ui.panel.right' };
      /** Below these widths a side panel is a sheet over the workspace instead of a column (shell.css). */
      const SHEET_BREAKPOINT = { right: '(max-width: 1099px)', left: '(max-width: 759px)' };

      class Shell {
        /** @param {HTMLElement} root */
        constructor(root) {
          this.root = root;
          this.modes = new Map();
          this.active = null;
          this.store = stateMod.createStore({ mode: null, datasets: [], selectedId: null, selectedIds: [], status: 'saved', pendingCode: null, openChartId: null, lastRun: null, lastExport: null, pendingSearch: null, lastSearch: null });
          this.ctx = {
            store: this.store,
            shell: this,
            services: { datasets, workspace, importer, exporter, files, idb },
            ui: Object.assign({ h, t, i18n, replace, icon: icons.icon, button: basic.button, datasetList }, overlays),
          };
          // Command palette (Ctrl+K): modes register their own commands through ctx.palette.register().
          this.palette = paletteMod.create(this);
          this.ctx.palette = this.palette;
          this.palette.register(() => this.builtinCommands());
          // The handbook's documents (ui/help), loaded when the palette first opens.
          this.palette.register(() => (D.has('ui/help') ? D.require('ui/help').commands() : []));
          // Beginner's course (Grundkurs): opened at the first start, from the help dialog and the palette.
          this.course = courseMod.create(this);
          // Internet access is asked for per purpose the first time it is needed (platform/consent).
          D.require('platform/consent').setAsker((purpose, info) => this.askConsent(purpose, info));
          this.build();
          this.store.subscribe((state, changed) => this.onState(state, changed));
          datasets.subscribe((type, payload) => this.onDatasets(type, payload));
          document.addEventListener('keydown', (e) => this.onKey(e));
        }

        build() {
          this.slots = { left: h('div', { class: 'dm-pane-body' }), center: h('main', { class: 'dm-center', id: 'dm-center' }), right: h('div', { class: 'dm-pane-body' }) };
          this.modeNav = h('nav', { class: 'dm-modes', 'aria-label': t('shell.modes') }, MODES.map((id) => h('button', {
            type: 'button', class: 'dm-mode-btn', 'data-mode': id, title: `${t('mode.' + id)} (Alt+${MODES.indexOf(id) + 1})`, onclick: () => this.activate(id),
          }, icons.icon(MODE_ICONS[id], 16), h('span', { text: t('mode.' + id) }))));
          this.themeBtn = basic.button({ label: t('shell.theme'), icon: THEME_ICON[theme.get()], 'icon-only': true, variant: 'ghost', onClick: () => this.toggleTheme() });
          this.langBtn = basic.button({ label: t('lang.title'), icon: 'languages', 'icon-only': true, variant: 'ghost', onClick: () => this.chooseLanguage() });
          this.logList = h('ul', { class: 'dm-log', 'aria-live': 'polite' });
          this.slots.center.setAttribute('tabindex', '-1');
          // Status bar at the bottom: save state, storage, the selected dataset, engines, network, panel toggles, log.
          this.statusEl = h('span', { class: 'dm-sb', 'data-state': 'saved' }, icons.icon('circle-check', 14), h('span', { text: t('shell.status.saved') }));
          this.storageEl = h('span', { class: 'dm-sb dm-sb-optional', text: '' });
          this.datasetEl = h('button', { type: 'button', class: 'dm-sb dm-sb-btn dm-sb-optional', 'aria-label': t('shell.dataset.current'), title: t('shell.dataset.current'), hidden: true, onclick: () => this.activate('hantera') });
          // One indicator per engine; Python's is shown once it has been started (it is a component fetched on demand).
          const engineButton = () => h('button', { type: 'button', class: 'dm-sb dm-sb-btn dm-sb-optional', 'data-engine': 'idle', title: t('shell.engine.hint'), onclick: () => this.activate('analysera') }, h('span', { class: 'dm-sb-dot', 'aria-hidden': 'true' }), h('span', { text: '' }));
          this.engineEls = { r: engineButton(), python: engineButton() };
          this.engineEl = this.engineEls.r;
          this.engineEls.python.hidden = true;
          this.netEl = h('span', { class: 'dm-sb dm-sb-optional', 'data-net': 'idle', title: t('shell.net.idle') }, h('span', { class: 'dm-sb-dot', 'aria-hidden': 'true' }), h('span', { text: t('shell.net') }));
          // A running flow and the news from the watches: only there when there is something to say.
          this.flowEl = h('button', { type: 'button', class: 'dm-sb dm-sb-btn dm-sb-flow', hidden: true, 'aria-label': t('shell.flow.hint'), title: t('shell.flow.hint'), onclick: () => this.openFlows('flows') }, icons.icon('play', 14), h('span'));
          this.watchEl = h('button', { type: 'button', class: 'dm-sb dm-sb-btn dm-sb-watch', hidden: true, 'aria-label': t('shell.watch.hint'), title: t('shell.watch.hint'), onclick: () => this.openFlows('watches') }, icons.icon('eye', 14), h('span'));
          this.statusBar = h('footer', { class: 'dm-statusbar', 'aria-label': t('shell.statusbar') },
            this.statusEl, h('span', { class: 'dm-sb-sep', 'aria-hidden': 'true' }), this.storageEl, this.datasetEl, this.flowEl, this.watchEl,
            h('span', { class: 'dm-sb-grow' }),
            this.engineEls.r, this.engineEls.python, this.netEl, h('span', { class: 'dm-sb-sep', 'aria-hidden': 'true' }),
            basic.button({ label: t('shell.toggle.left'), icon: 'panel-left', 'icon-only': true, size: 'sm', variant: 'ghost', onClick: () => this.toggle('left') }),
            basic.button({ label: t('shell.toggle.right'), icon: 'panel-right', 'icon-only': true, size: 'sm', variant: 'ghost', onClick: () => this.toggle('right') }),
            basic.button({ label: t('shell.log'), icon: 'panel-bottom', size: 'sm', variant: 'ghost', onClick: () => this.toggle('drawer') }));
          this.setEngine('r', rBridge.bridge.state);
          this.setEngine('python', pyBridge.bridge.state);
          this.el = h('div', { class: 'dm-shell', 'data-left': 'open', 'data-right': 'open', 'data-drawer': 'closed' },
            h('a', { class: 'dm-skip', href: '#dm-center', text: t('shell.skip'), onclick: (e) => { e.preventDefault(); this.slots.center.focus(); } }),
            h('header', { class: 'dm-topbar' },
              h('div', { class: 'dm-brand' }, icons.icon('dataspatium', 18), h('span', { text: t('app.name') })),
              this.modeNav,
              h('div', { class: 'dm-topbar-right' },
                basic.button({ label: t('palette.open'), icon: 'search', 'icon-only': true, variant: 'ghost', onClick: () => this.palette.open() }),
                this.langBtn,
                this.themeBtn,
                basic.button({ label: t('shell.help'), icon: 'circle-help', 'icon-only': true, variant: 'ghost', onClick: () => this.showHelp() }))),
            h('aside', { class: 'dm-left', 'aria-label': t('shell.objects') }, h('div', { class: 'dm-pane-head' }, h('span', { text: t('shell.objects') })), this.slots.left, h('dm-splitter', { for: 'left' })),
            this.slots.center,
            h('aside', { class: 'dm-right', 'aria-label': t('shell.inspector') }, h('dm-splitter', { for: 'right' }), h('div', { class: 'dm-pane-head' }, h('span', { text: t('shell.inspector') })), this.slots.right),
            h('section', { class: 'dm-drawer', 'aria-label': t('shell.drawer') },
              h('div', { class: 'dm-pane-head' }, h('span', { text: t('shell.drawer') }), basic.button({ label: t('common.close'), icon: 'x', 'icon-only': true, size: 'sm', variant: 'ghost', onClick: () => this.toggle('drawer') })),
              this.logList),
            this.statusBar);
          this.el.addEventListener('dm-resize', (e) => this.onPanelResize(/** @type {CustomEvent} */ (e).detail));
          // A side panel shown as a sheet closes when the workspace behind it is used or Escape is pressed; the
          // sheets start closed and the columns start open, following the window width.
          this.slots.center.addEventListener('pointerdown', () => this.closeSheets());
          this.el.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeSheets(); });
          for (const side of ['left', 'right']) {
            const mq = matchMedia(SHEET_BREAKPOINT[side]);
            mq.addEventListener('change', () => this.el.setAttribute('data-' + side, mq.matches ? 'closed' : 'open'));
            if (mq.matches) this.el.setAttribute('data-' + side, 'closed');
          }
          rBridge.bridge.on((type, payload) => { if (type === 'state') this.setEngine('r', payload.state); });
          pyBridge.bridge.on((type, payload) => { if (type === 'state') this.setEngine('python', payload.state); });
          if (D.net && D.net.onActivity) D.net.onActivity((active) => this.setNet(active));
          replace(this.root, this.el);
        }

        /** Engine indicator in the status bar: a dot coloured by state and the text "R redo". */
        setEngine(engine, state) {
          const el = this.engineEls && this.engineEls[engine];
          if (!el) return;
          el.setAttribute('data-engine', state);
          /** @type {HTMLElement} */ (el.lastChild).textContent = `${t('shell.engine.' + engine)} ${t(ENGINE_STATES[state] || ENGINE_STATES.idle)}`;
          // Python appears in the status bar once it has been started.
          if (engine === 'python') el.hidden = state === 'idle';
        }

        /** Hantera's page for flows and watches. */
        openFlows(tab) {
          this.activate('hantera');
          this.store.set({ selectedId: '__flows', flowsTab: tab });
        }
        /** What a flow is doing, in the status bar and the log. */
        listenToFlows() {
          const flows = D.require('data/flows');
          const watches = D.require('data/watches');
          flows.subscribe((type, p) => {
            if (type === 'step') {
              this.flowEl.hidden = false;
              this.flowEl.lastChild.textContent = t('shell.flow.step', { name: p.name, n: p.index + 1, total: p.total, step: p.label });
            } else if (type === 'end') {
              this.flowEl.hidden = true;
              for (const x of p.steps) this.log(`${p.name}: ${t('flows.step.' + x.type)}: ${x.message}`, x.ok ? 'info' : 'error');
              const text = t(p.ok ? 'flows.finished.ok' : (p.aborted ? 'flows.finished.aborted' : 'flows.finished.failed'), { name: p.name });
              this.log(text, p.ok ? 'ok' : 'error');
              overlays.toast.show(text, { kind: p.ok ? 'ok' : 'error', action: p.files.length ? { label: t('flows.fetch'), onClick: async () => { const out = await flows.output(p.flowId); if (out) D.require('platform/files').download(out.blob, out.name); } } : undefined });
            }
          });
          const showWatches = async () => {
            const n = (await watches.pending()).length;
            this.watchEl.hidden = !n;
            this.watchEl.lastChild.textContent = t('shell.watch.new', { n });
          };
          watches.subscribe(showWatches);
          showWatches();
          // Work at start waits until the page has settled, and never asks for anything.
          setTimeout(() => {
            flows.runOnStart({ onSkip: (flow, reasons) => this.log(t('flows.start.skipped', { name: flow.name, reason: reasons.join('; ') }), 'info') }).catch((err) => D.log('shell', 'flows at start', err));
            watches.checkOnStart().catch((err) => D.log('shell', 'watches at start', err));
          }, 1500);
        }

        /** Network indicator: lit while real network requests are in flight. */
        setNet(active) {
          this.netEl.setAttribute('data-net', active > 0 ? 'active' : 'idle');
          this.netEl.title = active > 0 ? t('shell.net.active', { n: active }) : t('shell.net.idle');
        }

        updateDatasetSummary(state) {
          const ds = state.datasets.find((d) => d.id === state.selectedId);
          // Collections are counted in their own units (documents and pages, pictures), tables in rows.
          this.datasetEl.textContent = ds ? `${ds.shortName || ds.name} · ${ds.kind === 'document' || ds.kind === 'images' ? datasetList.kindSummary(ds) : t('common.rows', { n: i18n.formatNumber(ds.rowCount || 0) })}` : '';
          this.datasetEl.hidden = !ds;
        }

        /** Panel widths from the last session, set through the splitters. */
        async applyWidths() {
          for (const [side, key] of Object.entries(WIDTH_SETTINGS)) {
            try {
              const w = await idb.getSetting(key, null);
              if (typeof w === 'number' && w > 0) this.el.style.setProperty(side === 'left' ? '--dm-panel-w' : '--dm-inspector-w', w + 'px');
            } catch (_err) { /* defaults */ }
          }
        }

        onPanelResize(detail) {
          const key = WIDTH_SETTINGS[detail.side];
          if (!key) return;
          (detail.width === null ? idb.deleteSetting(key) : idb.setSetting(key, detail.width)).catch((err) => D.log('shell', 'panel width', err));
        }

        /**
         * The consent question for a network purpose: what it is for, which host, and whether to remember.
         * @returns {Promise<{allow: boolean, remember: boolean}>}
         */
        async askConsent(purpose, info = {}) {
          const remember = /** @type {any} */ (h('dm-switch', { label: t('consent.remember') }));
          remember.checked = true;
          const details = [info.host ? t('consent.host', { host: info.host }) : '', info.label || '', info.size ? i18n.formatBytes(info.size) : ''].filter(Boolean).join(' · ');
          const choice = await overlays.dialog.open({
            title: t('consent.title'), help: 'faq#behöver-jag-internet',
            body: h('div', { class: 'dm-stack' },
              h('p', null, h('strong', { text: t('consent.purpose.' + purpose) + ': ' }), t('consent.purpose.' + purpose + '.body')),
              details ? h('p', { class: 'dm-help', text: details }) : null,
              h('p', { class: 'dm-help', text: t('consent.change.hint') }),
              remember),
            actions: [{ label: t('consent.deny'), value: false }, { label: t('consent.allow'), variant: 'primary', value: true, primary: true }],
          });
          const allow = choice === true;
          this.log(t(allow ? 'consent.logged.allow' : 'consent.logged.deny', { purpose: t('consent.purpose.' + purpose) }), allow ? 'info' : 'warn');
          return { allow, remember: choice === undefined ? false : !!remember.checked };
        }

        /** Close side panels shown as sheets (narrow windows). */
        closeSheets() {
          for (const side of ['left', 'right']) if (this.el.getAttribute('data-' + side) === 'sheet') this.el.setAttribute('data-' + side, 'closed');
        }

        registerMode(mode) { this.modes.set(mode.id, mode); }

        async init() {
          // The very first start: let the user pick the language before anything else is shown.
          if (!i18n.hasChoice()) await this.chooseLanguage({ required: true });
          // Datasets from versions before short names get one, derived from their name.
          try { await datasets.ensureShortNames(); } catch (err) { D.log('shell', 'short names', err); }
          await this.reloadDatasets();
          this.updateStorage();
          await this.applyWidths();
          this.listenToFlows();
          // Land where the user most likely wants to be: an empty workspace starts in Inhämta, one with
          // datasets in Hantera. An explicit #/mode in the URL wins.
          const route = this.parseRoute();
          const landing = this.store.get().datasets.length ? 'hantera' : 'inhamta';
          this.activate(MODES.includes(route.mode) ? route.mode : landing);
          if (route.object) this.openRoute(route).catch((err) => D.log('shell', 'route', err));
          window.addEventListener('hashchange', () => {
            const r = this.parseRoute();
            if (!MODES.includes(r.mode)) return;
            if (r.mode !== this.store.get().mode) this.activate(r.mode);
            if (r.object) this.openRoute(r).catch((err) => D.log('shell', 'route', err));
          });
          this.course.autoStart();
          this.remindBackup();
          this.versionNotice();
          // An installed app (served from a web server, added to the home screen) asks the browser to keep its storage.
          if (!D.capabilities.isFileProtocol && matchMedia('(display-mode: standalone)').matches) idb.requestPersist().catch(() => {});
        }

        /** Download a backup of the workspace (the action of reminders and notices). */
        async backupNow() {
          try {
            const { blob } = await workspace.backup();
            files.download(blob, t('datasets.backup.file', { stamp: new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') }));
            this.log(t('datasets.backup.done'), 'ok');
          } catch (err) { this.log(String((err && err.message) || err), 'error'); }
        }

        /** The first start after a new main version: suggest a backup, since the storage format moved on. */
        async versionNotice() {
          const KEY = 'app.lastVersion';
          let last = null;
          try { last = await idb.getSetting(KEY, null); } catch (_err) { last = null; }
          if (last !== D.version) idb.setSetting(KEY, D.version).catch(() => {});
          const major = (v) => Number(String(v || '').split('.')[0]) || 0;
          if (!last || !this.store.get().datasets.length || major(last) >= major(D.version)) return;
          const message = t('app.upgraded', { from: last, to: D.version });
          this.log(message, 'info');
          this.toast(message, { kind: 'info', timeout: 20000, action: { label: t('backup.now'), onClick: () => this.backupNow() } });
        }

        /** Once per start: a warning when the workspace has not been backed up within the interval set under Hantera. */
        async remindBackup() {
          try {
            const st = await workspace.backupStatus();
            if (!st.due) return;
            const message = st.lastAt ? t('backup.due', { days: st.daysSince }) : t('backup.due.never');
            this.log(message, 'warn');
            this.toast(message, { kind: 'warn', timeout: 15000, action: { label: t('backup.now'), onClick: () => this.backupNow() } });
          } catch (_err) { /* reminders are best effort */ }
        }

        /**
         * Deep links: `#/<mode>` and `#/<mode>/<object>`, where the object is a dataset's short name or id, a chart's
         * id or name (Visualisera) or a search text (Söka). They work from file:// too and are what QR codes and
         * published pages point at.
         */
        parseRoute() {
          const parts = (location.hash || '').replace(/^#\/?/, '').split('/');
          let object = parts.slice(1).join('/');
          try { object = decodeURIComponent(object); } catch (_err) { /* keep as typed */ }
          return { mode: parts[0] || '', object };
        }
        /** The address of a mode and an object, for copying and QR codes. */
        link(mode, object) {
          const base = location.href.replace(/#.*$/, '');
          return base + '#/' + mode + (object ? '/' + encodeURIComponent(object) : '');
        }
        /** Apply the object part of a route in the mode that is already active. */
        async openRoute(route) {
          const { mode, object } = route;
          const state = this.store.get();
          const byName = (o) => state.datasets.find((d) => d.shortName === o || d.id === o || d.name === o) || null;
          if (mode === 'soka') { this.store.set({ pendingSearch: { text: object, at: Date.now() } }); }
          else if (mode === 'visualisera') {
            const charts = await D.require('viz/charts').list();
            const chart = charts.find((c) => c.id === object || c.name === object);
            if (chart) this.store.set({ selectedId: chart.datasetId || state.selectedId, openChartId: chart.id });
            else { const ds = byName(object); if (ds) this.store.set({ selectedId: ds.id }); }
          } else { const ds = byName(object); if (ds) this.store.set({ selectedId: ds.id }); }
          const wanted = '#/' + mode + '/' + encodeURIComponent(object);
          if (location.hash !== wanted) history.replaceState(null, '', wanted);
        }

        /** Switch mode. */
        activate(id) {
          const mode = this.modes.get(id);
          if (!mode) return;
          if (this.active && this.active.deactivate) this.active.deactivate();
          for (const slot of Object.values(this.slots)) slot.replaceChildren();
          this.active = mode;
          this.store.set({ mode: id });
          for (const btn of this.modeNav.children) btn.setAttribute('aria-current', btn.getAttribute('data-mode') === id ? 'page' : 'false');
          if (location.hash !== '#/' + id) history.replaceState(null, '', '#/' + id);
          mode.activate(this.slots);
        }

        onState(state, changed) {
          if (changed.includes('status')) {
            const map = { saved: ['circle-check', 'shell.status.saved'], saving: ['loader-circle', 'shell.status.saving'], unsaved: ['triangle-alert', 'shell.status.unsaved'] };
            const [icon, key] = map[state.status] || map.saved;
            this.statusEl.setAttribute('data-state', state.status);
            replace(this.statusEl, icons.icon(icon, 14), h('span', { text: t(key) }));
          }
          if (changed.includes('selectedId') || changed.includes('datasets')) this.updateDatasetSummary(state);
          if (this.active && this.active.update && !changed.includes('mode')) this.active.update(state, changed);
        }

        async onDatasets(type, payload) {
          if (type === 'protected-lost') {
            this.ctx.ui.toast.show(t('protected.lost', { columns: payload.columns.join(', ') }), { kind: 'warn', timeout: 15000, action: { label: t('common.undo'), onClick: () => { D.require('data/recipes').undo(payload.id).catch((err) => this.log(String((err && err.message) || err), 'error')); } } });
            return;
          }
          if (type === 'dirty') { this.setStatus('unsaved'); return; }
          if (type === 'saving') { this.setStatus('saving'); return; }
          if (type === 'saved') { this.setStatus(datasets.hasPendingSaves() ? 'unsaved' : 'saved'); return; }
          if (type === 'remote') this.log(t('sync.' + (payload.action === 'deleted' ? 'deleted' : payload.action === 'created' ? 'created' : 'saved'), { name: payload.name || payload.id || '' }));
          await this.reloadDatasets();
          if ((type === 'deleted' || (type === 'remote' && payload.action === 'deleted')) && this.store.get().selectedId === payload.id) this.store.set({ selectedId: null });
          if (type === 'created') this.store.set({ selectedId: payload.id });
          this.updateStorage();
        }

        async reloadDatasets() {
          const list = await datasets.list();
          // Multi-selection (Hantera) keeps only datasets that still exist.
          const ids = new Set(list.map((d) => d.id));
          const current = this.store.get().selectedIds || [];
          const kept = current.filter((id) => ids.has(id));
          this.store.set(kept.length === current.length ? { datasets: list } : { datasets: list, selectedIds: kept });
          return list;
        }

        async updateStorage() {
          const est = await idb.estimate();
          this.storageEl.textContent = est && est.usage ? t('shell.storage', { used: i18n.formatBytes(est.usage) }) : '';
        }

        /**
         * Show or hide a panel. The drawer opens and closes in place; a side panel is a column on wide windows
         * ("open") and a sheet over the workspace on narrow ones ("sheet"), see SHEET_BREAKPOINT.
         * @param {'left'|'right'|'drawer'} which
         */
        toggle(which) {
          const key = 'data-' + which;
          const current = this.el.getAttribute(key);
          if (which === 'drawer') { this.el.setAttribute(key, current === 'open' ? 'closed' : 'open'); return; }
          const shown = current === 'open' || current === 'sheet';
          this.el.setAttribute(key, shown ? 'closed' : (matchMedia(SHEET_BREAKPOINT[which]).matches ? 'sheet' : 'open'));
        }

        onKey(e) {
          if (e.altKey && !e.ctrlKey && !e.metaKey && /^[1-8]$/.test(e.key)) { e.preventDefault(); this.activate(MODES[Number(e.key) - 1]); }
          else if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); this.palette.open(); }
          else if (e.key === 'F1' && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); this.showHelp(); }
        }

        toggleTheme() {
          const next = theme.cycle();
          this.themeBtn.setAttribute('icon', THEME_ICON[next]);
          this.toast(t('shell.theme.' + next));
        }

        /**
         * Language chooser: the choice is saved and the page reloads, after pending saves are flushed.
         * With `required` (the first start) the dialog cannot be dismissed; the detected language is
         * preselected and keeping it just records the choice without a reload.
         * @param {{required?: boolean}} [options]
         * @returns {Promise<string|null>} the chosen language code, or null when cancelled
         */
        async chooseLanguage(options = {}) {
          const required = !!options.required;
          let done = (_code) => {};
          const list = h('div', { class: 'dm-list', role: 'radiogroup', 'aria-label': t('lang.title') }, i18n.LANGUAGES.map((l) => h('button', {
            type: 'button', class: 'dm-list-item', role: 'radio', lang: l.locale.split('-')[0], 'aria-checked': l.code === i18n.language() ? 'true' : 'false', 'aria-current': l.code === i18n.language() ? 'true' : null,
            onclick: () => done(l.code),
          }, icons.icon('languages', 14), h('span', { class: 'dm-list-main' }, h('span', { text: l.label }), h('span', { class: 'dm-list-sub', text: l.locale })))));
          const currentLabel = (i18n.LANGUAGES.find((l) => l.code === i18n.language()) || i18n.LANGUAGES[0]).label;
          const intro = required
            ? h('p', { class: 'dm-help' }, i18n.LANGUAGES.map((l, i) => h('span', { lang: l.locale.split('-')[0], text: i18n.tIn(l.code, 'lang.first.hint') + (i < i18n.LANGUAGES.length - 1 ? ' · ' : '') })))
            : h('p', { class: 'dm-help', text: t('lang.hint') });
          let chosen = await overlays.dialog.open({
            title: required ? t('lang.first.title') : t('lang.title'),
            body: (close) => { done = close; return h('div', { class: 'dm-stack' }, intro, list); },
            actions: required ? [{ label: t('lang.first.keep', { language: currentLabel }), value: 'keep' }] : [{ label: t('common.cancel'), value: false }],
            closable: !required,
          });
          if (chosen === 'keep' || (required && !chosen)) chosen = i18n.language();
          if (!chosen) return null;
          if (chosen === i18n.language()) { i18n.setLanguage(chosen); return chosen; }
          try { await datasets.flushSaves(); } catch (_err) { /* best effort before the reload */ }
          i18n.setLanguage(chosen);
          this.reload();
          return chosen;
        }

        /** Reload the page; a new language applies everywhere after a reload. Tests replace this method. */
        reload() {
          const target = withoutLangParam(location.href);
          if (target) location.replace(target); else location.reload();
        }

        /** Commands always available in the palette: modes, datasets, the workspace, theme and help. */
        builtinCommands() {
          const state = this.store.get();
          const cmds = MODES.map((id) => ({ id: 'mode:' + id, label: t('palette.goto', { mode: t('mode.' + id) }), hint: t('mode.' + id + '.desc'), group: t('palette.group.modes'), icon: MODE_ICONS[id], run: () => this.activate(id) }));
          for (const d of state.datasets) {
            cmds.push({
              id: 'dataset:' + d.id, label: d.name, hint: d.shortName || '', group: t('palette.group.datasets'), icon: 'table', keywords: [t('shell.datasets'), d.shortName || ''],
              hint: datasetList.kindSummary(d),
              run: () => { this.store.set({ selectedId: d.id }); if (!this.store.get().mode || this.store.get().mode === 'inhamta') this.activate('bearbeta'); },
            });
          }
          // '__workspace' is the workspace entry's id in the Hantera dataset list (WORKSPACE in ui/modes/hantera).
          cmds.push({ id: 'workspace', label: t('datasets.storage.title'), hint: t('datasets.backup'), group: t('palette.group.actions'), icon: 'hard-drive', run: () => { this.activate('hantera'); this.store.set({ selectedId: '__workspace' }); } });
          cmds.push({ id: 'theme', label: t('shell.theme'), group: t('palette.group.actions'), icon: THEME_ICON[theme.get()], run: () => this.toggleTheme() });
          // A deep link to the current mode and dataset (#/<mode>/<short name>), for notes, QR codes and e-mails.
          cmds.push({
            id: 'link', label: t('shell.link.copy'), hint: t('shell.link.hint'), group: t('palette.group.actions'), icon: 'link',
            run: () => {
              const s = this.store.get();
              const ds = s.datasets.find((d) => d.id === s.selectedId);
              const url = this.link(s.mode || 'hantera', ds ? (ds.shortName || ds.id) : '');
              navigator.clipboard.writeText(url).then(() => this.toast(t('shell.link.copied'), { kind: 'ok' })).catch(() => this.toast(url, { kind: 'info', timeout: 15000 }));
            },
          });
          cmds.push({ id: 'help', label: t('shell.help'), hint: t('app.version', { version: D.version }), group: t('palette.group.actions'), icon: 'circle-help', run: () => this.showHelp() });
          cmds.push({ id: 'lang', label: t('lang.title'), hint: 'Svenska · Dansk · Norsk · Suomi · Íslenska · English', group: t('palette.group.actions'), icon: 'languages', run: () => this.chooseLanguage() });
          cmds.push({ id: 'course', label: t('course.open'), hint: t('course.open.hint'), group: t('palette.group.actions'), icon: 'graduation-cap', keywords: [t('course.title')], run: () => this.course.open() });
          cmds.push({ id: 'update', label: t('update.check'), group: t('palette.group.actions'), icon: 'refresh-cw', run: () => this.showHelp() });
          return cmds;
        }

        /** Append to the log drawer and the console. */
        log(message, kind = 'info') {
          const now = new Date();
          const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
          this.logList.appendChild(h('li', { 'data-kind': kind }, h('time', { text: time }), h('span', { text: message })));
          this.logList.scrollTop = this.logList.scrollHeight;
          (kind === 'error' ? console.error : console.log)('[dataspatium] ' + message);
        }

        toast(message, opts) { return overlays.toast.show(message, opts); }
        setStatus(status) { this.store.set({ status }); }

        showHelp() {
          // The handbook (ui/help) opens at the chapter of the active mode; the update check lives in its footer.
          return D.require('ui/help').openForMode(this.store.get().mode || 'inhamta')
            .catch((err) => { console.error(err); this.toast(t('help.error'), { kind: 'warn' }); });
        }
      }

      /**
       * `href` without its `lang` parameter, which would override a newly chosen language at the reload;
       * null when there is none.
       * @param {string} href
       * @returns {string|null}
       */
      function withoutLangParam(href) {
        const url = new URL(href);
        if (!url.searchParams.has('lang')) return null;
        url.searchParams.delete('lang');
        return url.toString();
      }

      function create(root) { return new Shell(root); }
      return { create, MODES, MODE_ICONS, withoutLangParam };
    });
})();
