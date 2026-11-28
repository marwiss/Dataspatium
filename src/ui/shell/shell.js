// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Application shell: builds the fixed layout (top bar with the nine modes, object panel, workspace,
 * inspector, log drawer, status bar), owns the store and hands each mode the same slots and services.
 *
 * Mode contract: { id, activate(slots), deactivate(), update?(state, changed) } created by
 * `createMode(ctx)` in src/ui/modes/*.js. The modes beyond the start are registered with `registerLazyMode` and created
 * when their group of scripts (src/boot.js) has loaded; `activate` and `openRoute` wait for it.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/shell', ['ui/components', 'ui/base', 'ui/icons', 'ui/basic', 'ui/overlays', 'ui/theme', 'ui/state', 'ui/dataset-list', 'data/datasets', 'data/workspace', 'io/import', 'io/export', 'platform/files', 'platform/storage/idb', 'ui/command-palette', 'ui/course', 'data/r-bridge', 'data/python-bridge', 'data/selection', 'platform/tier'], (_components, base, icons, basic, overlays, theme, stateMod, datasetList, datasets, workspace, importer, exporter, files, idb, paletteMod, courseMod, rBridge, pyBridge, selectionMod, tier) => {
      const { h, t, i18n, replace } = base;
      const MODES = ['inhamta', 'hantera', 'soka', 'bearbeta', 'kontrollera', 'analysera', 'visualisera', 'exportera', 'dela'];
      const MODE_ICONS = { inhamta: 'download', hantera: 'database', soka: 'text-search', bearbeta: 'wand-sparkles', kontrollera: 'list-checks', analysera: 'terminal', visualisera: 'chart-column', exportera: 'file-output', dela: 'share-2' };
      const THEME_ICON = { auto: 'sun', light: 'sun', dark: 'moon' };
      const ENGINE_STATES = { idle: 'shell.engine.state.idle', starting: 'shell.engine.state.starting', ready: 'shell.engine.state.ready', busy: 'shell.engine.state.busy', error: 'shell.engine.state.error' };
      /** Settings keys for the panel widths set with the splitters. */
      const WIDTH_SETTINGS = { left: 'ui.panel.left', right: 'ui.panel.right', drawer: 'ui.panel.drawer' };
      /** Below these widths a side panel is a sheet over the workspace instead of a column (shell.css). */
      const SHEET_BREAKPOINT = { right: '(max-width: 1099px)', left: '(max-width: 759px)' };

      class Shell {
        /** @param {HTMLElement} root */
        constructor(root) {
          this.root = root;
          this.modes = new Map();
          /** Modes whose scripts are a group loaded at first use: id → {group, module} (registerLazyMode). */
          this.lazyModes = new Map();
          /** The mode asked for last, and a lazy one on its way ({id, done}); a mode that loads late opens only if still wanted. */
          this.wanted = null;
          this.pending = null;
          this.active = null;
          this.store = stateMod.createStore({ mode: null, datasets: [], selectedId: null, selectedIds: [], status: 'saved', pendingCode: null, openChartId: null, lastRun: null, lastExport: null, pendingSearch: null, lastSearch: null, pendingDocument: null });
          this.ctx = {
            store: this.store,
            shell: this,
            services: { datasets, workspace, importer, exporter, files, idb },
            ui: Object.assign({ h, t, i18n, replace, icon: icons.icon, button: basic.button, datasetList }, overlays),
          };
          // Every mode's dataset tree is the same: check boxes on the store's selection, the tools above it and drag and drop
          // (ui/batch-actions, which the start loads after the shell).
          this.ctx.ui.datasetList = datasetList.withDefaults(() => (D.has('ui/batch-actions') ? D.require('ui/batch-actions').treeOptions(this.ctx) : {}));
          // Command palette (Ctrl+K): modes register their own commands through ctx.palette.register().
          this.palette = paletteMod.create(this);
          this.ctx.palette = this.palette;
          this.palette.register(() => this.builtinCommands());
          // The handbook's documents (ui/help), loaded when the palette first opens.
          this.palette.register(() => (D.has('ui/help') ? D.require('ui/help').commands() : []));
          // The modes not yet used add their commands when created: the first opening loads their groups, and the open
          // palette lists the commands as they come.
          this.palette.register(() => {
            const missing = Array.from(this.lazyModes.keys()).filter((id) => !this.modes.has(id));
            if (missing.length) Promise.all(missing.map((id) => this.loadMode(id))).then(() => this.palette.refresh()).catch((err) => D.log('shell', 'modes for the palette', err));
            return [];
          });
          // Beginner's course (Grundkurs): opened at the first start, from the help dialog and the palette.
          this.course = courseMod.create(this);
          // Internet access is asked for per purpose the first time it is needed (platform/consent).
          D.require('platform/consent').setAsker((purpose, info) => this.askConsent(purpose, info));
          this.build();
          this.wasOnPage = this.root.isConnected;
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
          this.loadingEl = h('span', { class: 'dm-sb dm-sb-optional dm-sb-loading', hidden: true, 'data-loading': '', title: t('shell.loading.hint') }, h('dm-progress', { indeterminate: '' }), h('span', { text: '' }),
            basic.button({ label: t('shell.loading.abort'), icon: 'x', 'icon-only': true, size: 'sm', variant: 'ghost', 'data-loading-abort': '', onClick: () => { if (D.downloads) D.downloads.abortAll(); } }));
          this.flowEl = h('button', { type: 'button', class: 'dm-sb dm-sb-btn dm-sb-flow', hidden: true, 'aria-label': t('shell.flow.hint'), title: t('shell.flow.hint'), onclick: () => this.openFlows('flows') }, icons.icon('play', 14), h('span'));
          // AI-assistent (F35 a): the AI that works with the app's commands, in a floating panel in every mode.
          this.assistantEl = h('button', { type: 'button', class: 'dm-sb dm-sb-btn dm-sb-assistant', 'aria-label': t('assistant.open'), title: t('assistant.open.hint'), hidden: !tier.shows('status:assistant'), onclick: () => this.openAssistant() }, icons.icon('sparkles', 14));
          // Styrning utifrån (F30 a): shown while programs on the computer may run commands through the bridge; opens the settings.
          this.remoteEl = h('button', { type: 'button', class: 'dm-sb dm-sb-btn dm-sb-remote', hidden: true, 'aria-label': t('remote.sb.hint'), title: t('remote.sb.hint'), onclick: () => { this.activate('hantera'); this.store.set({ selectedId: '__workspace' }); } }, icons.icon('terminal', 14));
          // Stoppa: the flow stops before its next step or round (decision F33 b).
          this.flowStopEl = h('button', { type: 'button', class: 'dm-sb dm-sb-btn dm-sb-flow dm-sb-flow-stop', hidden: true, 'aria-label': t('flows.cancel'), title: t('flows.cancel.hint'), onclick: () => D.require('data/flows').cancel() }, icons.icon('octagon-x', 14));
          this.commentsEl = h('button', { type: 'button', class: 'dm-sb dm-sb-btn dm-sb-comments', hidden: true, 'aria-label': t('shell.comments.hint'), title: t('shell.comments.hint'), onclick: () => this.openUnread() }, icons.icon('message-square', 14), h('span'));
          this.watchEl = h('button', { type: 'button', class: 'dm-sb dm-sb-btn dm-sb-watch', hidden: true, 'aria-label': t('shell.watch.hint'), title: t('shell.watch.hint'), onclick: () => this.openFlows('watches') }, icons.icon('eye', 14), h('span'));
          this.selectionEl = h('button', { type: 'button', class: 'dm-sb dm-sb-btn dm-sb-selection', hidden: true, 'aria-label': t('selection.status.hint'), title: t('selection.status.hint'), onclick: () => this.selectionMenu() }, icons.icon('list-checks', 14), h('span'));
          selectionMod.subscribe((s) => this.showSelection(s));
          this.statusBar = h('footer', { class: 'dm-statusbar', 'aria-label': t('shell.statusbar') },
            this.statusEl, h('span', { class: 'dm-sb-sep', 'aria-hidden': 'true' }), this.storageEl, this.datasetEl, this.selectionEl, this.flowEl, this.flowStopEl, this.assistantEl, this.remoteEl, this.watchEl, this.commentsEl,
            h('span', { class: 'dm-sb-grow' }),
            this.engineEls.r, this.engineEls.python, this.loadingEl, this.netEl, h('span', { class: 'dm-sb-sep', 'aria-hidden': 'true' }),
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
            (this.leftAside = h('aside', { class: 'dm-left', 'aria-label': t('shell.datasets') }, h('div', { class: 'dm-pane-head' }, (this.leftTitle = h('span', { text: t('shell.datasets') }))), this.slots.left, h('dm-splitter', { for: 'left' }))),
            this.slots.center,
            h('aside', { class: 'dm-right', 'aria-label': t('shell.inspector') }, h('dm-splitter', { for: 'right' }), h('div', { class: 'dm-pane-head' }, h('span', { text: t('shell.inspector') })), this.slots.right),
            h('section', { class: 'dm-drawer', 'aria-label': t('shell.drawer') },
              h('dm-splitter', { for: 'drawer' }),
              h('div', { class: 'dm-pane-head' }, h('span', { text: t('shell.drawer') }), basic.button({ label: t('common.close'), icon: 'x', 'icon-only': true, size: 'sm', variant: 'ghost', onClick: () => this.toggle('drawer') })),
              this.logList),
            this.statusBar);
          this.el.addEventListener('dm-resize', (e) => this.onPanelResize(/** @type {CustomEvent} */ (e).detail));
          // A side panel shown as a sheet closes when the workspace behind it is used or Escape is pressed; the
          // sheets start closed and the columns start open, following the window width.
          this.slots.center.addEventListener('pointerdown', () => this.closeSheets());
          // A choice in the object panel's tree (ui/dataset-list: dm-choose) closes the panel when it is a sheet.
          this.slots.left.addEventListener('dm-choose', () => { if (this.el.getAttribute('data-left') === 'sheet') this.el.setAttribute('data-left', 'closed'); });
          this.el.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeSheets(); });
          for (const side of ['left', 'right']) {
            const mq = matchMedia(SHEET_BREAKPOINT[side]);
            mq.addEventListener('change', () => this.el.setAttribute('data-' + side, mq.matches ? 'closed' : 'open'));
            if (mq.matches) this.el.setAttribute('data-' + side, 'closed');
          }
          rBridge.bridge.on((type, payload) => { if (type === 'state') this.setEngine('r', payload.state); });
          pyBridge.bridge.on((type, payload) => { if (type === 'state') this.setEngine('python', payload.state); });
          if (D.net && D.net.onActivity) D.net.onActivity((active) => this.setNet(active));
          if (D.assets && D.assets.onProgress) D.assets.onProgress((info, active) => this.showLoading(active));
          // Downloads over the network (components, and the app's files when served by a web server) redraw the same indicator.
          if (D.downloads && D.downloads.onChange) D.downloads.onChange(() => this.showLoading(D.assets && D.assets.loading ? D.assets.loading() : []));
          replace(this.root, this.el);
        }

        /** Engine indicator in the status bar: a dot coloured by state and the text "R redo". */
        /** Big assets loading (R, Python, three.js, pdf.js…): the status bar names them, so a long first start is not a frozen app. */
        showLoading(active) {
          const el = this.loadingEl;
          if (!el) return;
          const bar = /** @type {any} */ (el.firstChild);
          const text = /** @type {HTMLElement} */ (el.children[1]);
          const abortBtn = /** @type {HTMLElement} */ (el.children[2]);
          const fmt = D.require('ui/i18n').formatBytes;
          const dl = D.downloads ? D.downloads.summary() : { count: 0 };
          if (dl.count) {
            // Over the network: what is being fetched, bytes of the total, the speed, and the time left at that speed.
            const last = dl.items[dl.items.length - 1];
            const known = dl.total > 0;
            let line = known
              ? t('shell.loading.progress', { name: last.label, received: fmt(dl.received), total: fmt(dl.total), speed: fmt(dl.speed) })
              : t('shell.loading', { name: last.label, size: fmt(dl.received) });
            if (dl.remaining !== null) line += ' · ' + t('shell.loading.eta', { time: D.downloads.formatSeconds(dl.remaining) });
            text.textContent = line;
            if (known) { bar.removeAttribute('indeterminate'); bar.setAttribute('value', String(Math.round((dl.received / dl.total) * 100))); } else bar.setAttribute('indeterminate', '');
            abortBtn.hidden = false;
            el.hidden = false;
            return;
          }
          const big = (active || []).filter((x) => (x.size || 0) >= 512 * 1024);
          if (!big.length) { el.hidden = true; return; }
          const last = big[big.length - 1];
          const total = big.reduce((a, x) => a + (x.size || 0), 0);
          bar.setAttribute('indeterminate', '');
          text.textContent = t('shell.loading', { name: String(last.name).split('/')[0], size: fmt(total) });
          abortBtn.hidden = true;
          el.hidden = false;
        }
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
        /**
         * The tier changed (platform/tier): the status bar's items follow it, an open assistant closes when the tier no longer holds
         * it, and the active mode is drawn again, so that its entry points show what the tier now holds; the page keeps its place,
         * and focus goes back to the card Nivå (or to the page) once it is drawn. A mode still loading draws with the new tier when
         * it opens. Nothing is loaded, no dataset changes, and the address stays as it is. A shell no longer on the page does nothing.
         */
        applyTier() {
          if (!this.root.isConnected) return;
          this.assistantEl.hidden = !tier.shows('status:assistant');
          if (!tier.shows('assistant') && D.has('ui/assistant')) { const open = D.require('ui/assistant').current(); if (open) open.panel.close(); }
          if (this.pending) return;
          const id = this.store.get().mode;
          if (!id || !this.modes.has(id)) return;
          const center = this.slots.center;
          const top = center.scrollTop;
          const focused = /** @type {any} */ (document.activeElement);
          const inCard = !!(focused && focused.closest && focused.closest('[data-settings="tier"]'));
          const inCenter = !!(focused && center.contains(focused));
          this.activate(id, { redraw: true });
          if (!top && !inCenter) return;
          // The modes draw asynchronously (Hantera's workspace awaits its cards): wait a few frames for the page, then put it back.
          let frames = 0;
          const settle = () => {
            if (this.store.get().mode !== id) return;
            const card = center.querySelector('[data-settings="tier"]');
            if ((inCard ? !card : !center.childElementCount) && frames++ < 120) { requestAnimationFrame(settle); return; }
            center.scrollTop = top;
            const target = inCard && card ? card.querySelector('[aria-checked="true"]') : null;
            if (target) /** @type {HTMLElement} */ (target).focus({ preventScroll: true });
            else if (inCenter && (!document.activeElement || document.activeElement === document.body)) center.focus({ preventScroll: true });
          };
          requestAnimationFrame(settle);
        }
        /** The floating AI assistant (ui/assistant, the group 'assistant'); one per page, kept while the app is open. */
        openAssistant() {
          return D.ensure(['assistant'], () => D.require('ui/assistant').open(this.ctx)).catch((err) => this.partFailed(err));
        }
        /** A group of scripts that did not load (src/boot.js), or another error: in the log and a toast, in words the user can act on. */
        partFailed(err) {
          const message = err && err.path ? t('shell.part.failed', { file: err.path }) : String((err && err.message) || err);
          this.log(message, 'error');
          this.toast(message, { kind: 'error' });
        }
        /** What a flow is doing, in the status bar and the log. */
        listenToFlows() {
          const flows = D.require('data/flows');
          const watches = D.require('data/watches');
          // The step ask shows its question here (F34 a); a test may put its own answerer in place.
          flows.setAsker((q) => D.require('ui/ask').ask(q));
          // Styrning utifrån: the confirmation when it goes on, the approval of a writing command, the log line per command. The
          // approval is in the start list (ui/approve), so that it needs no group of a higher tier, nor a network for one.
          const remote = D.require('api/remote');
          remote.setAsker({
            confirm: () => overlays.dialog.confirm(t('remote.confirm'), { title: t('remote.switch') }),
            approve: (cmd, args, options) => D.require('ui/approve').approve(cmd, args, options),
            log: (text, kind) => this.log(text, kind),
          });
          remote.subscribe((s) => { this.remoteEl.hidden = !s.on; this.remoteEl.classList.toggle('dm-sb-remote-off', !s.connected); });
          flows.subscribe((type, p) => {
            if (type === 'step') {
              this.flowEl.hidden = false; this.flowStopEl.hidden = false;
              this.flowEl.lastChild.textContent = t('shell.flow.step', { name: p.name, n: p.index + 1, total: p.total, step: p.label });
            } else if (type === 'end') {
              this.flowEl.hidden = true; this.flowStopEl.hidden = true;
              // A long run with loops logs what failed, the remarks and how it ended, not every round.
              const lines = p.steps.length > 30 ? p.steps.filter((x, i) => !x.ok || x.warn || i === p.steps.length - 1) : p.steps;
              for (const x of lines) this.log(`${p.name}: ${x.path ? x.path + ' ' : ''}${t('flows.step.' + x.type)}: ${x.message}`, x.ok ? (x.warn ? 'warn' : 'info') : 'error');
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
          // Comments from others, fetched from a repository and not yet looked at.
          const collab = D.require('data/collab');
          const showUnread = async () => {
            const { total } = await collab.unread();
            this.commentsEl.hidden = !total;
            this.commentsEl.lastChild.textContent = t('shell.comments.new', { n: i18n.formatNumber(total) });
          };
          collab.onUnread(() => { showUnread().catch((err) => D.log('collab', err)); });
          showUnread().catch((err) => D.log('collab', err));
          // Work at start waits until the page has settled, and never asks for anything.
          setTimeout(() => {
            flows.runOnStart({ onSkip: (flow, reasons) => this.log(t('flows.start.skipped', { name: flow.name, reason: reasons.join('; ') }) + ' ' + t('flows.start.hint'), 'info') }).catch((err) => D.log('shell', 'flows at start', err));
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

        /** The selection in the status bar, in the units of its dataset. */
        showSelection(sel) {
          this.selectionEl.hidden = !sel;
          if (sel) this.selectionEl.lastChild.textContent = t('selection.status', { n: i18n.formatNumber(sel.rowids.length) });
        }
        /** What can be done with the selection, wherever the user happens to be. */
        async selectionMenu() {
          const sel = selectionMod.get();
          if (!sel) { this.showSelection(null); return; }
          let action = null;
          const pick = (id, label, help, primary) => h('button', { type: 'button', class: 'dm-op-tile', 'data-action': id, 'data-primary': primary ? '' : null, onclick: () => { action = id; const dlg = body.closest('dialog'); if (dlg) /** @type {HTMLElement} */ (dlg.querySelector('.dm-dialog-actions dm-button button')).click(); } }, h('strong', { text: label }), h('span', { class: 'dm-help', text: help }));
          const body = h('div', { class: 'dm-stack-sm' },
            pick('list', t('selection.menu.list'), t('selection.menu.list.hint')),
            pick('dataset', t('selection.menu.dataset'), t('selection.menu.dataset.hint')),
            pick('clear', t('selection.menu.clear'), t('selection.menu.clear.hint')));
          await overlays.dialog.open({ title: t('selection.status', { n: i18n.formatNumber(sel.rowids.length) }), help: 'hantera', body, actions: [{ label: t('common.close'), value: false }] });
          try {
            if (action === 'clear') selectionMod.clear();
            if (action === 'list') {
              const name = await overlays.dialog.prompt(t('soka.list.name'), { title: t('selection.menu.list'), value: '' });
              if (name) { const rec = await selectionMod.toList(name); overlays.toast.show(t('soka.list.saved', { name: rec.name }), { kind: 'ok' }); }
            }
            if (action === 'dataset') {
              const name = await overlays.dialog.prompt(t('text.dataset.name'), { title: t('selection.menu.dataset'), value: '' });
              if (name) { const meta = await selectionMod.toDataset(name); this.store.set({ selectedId: meta.id }); }
            }
          } catch (err) { this.log(String((err && err.message) || err), 'error'); overlays.toast.show(String((err && err.message) || err), { kind: 'error' }); }
        }

        /** Panel widths from the last session, set through the splitters. */
        async applyWidths() {
          for (const [side, key] of Object.entries(WIDTH_SETTINGS)) {
            try {
              const w = await idb.getSetting(key, null);
              if (typeof w === 'number' && w > 0) this.el.style.setProperty(side === 'drawer' ? '--dm-drawer-h' : side === 'left' ? '--dm-panel-w' : '--dm-inspector-w', w + 'px');
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
              // Asked per host (F102 a, F103 a): the answer is kept for these hosts only.
              h('p', { class: 'dm-help', 'data-consent-perhost': info.perHost ? '' : null, text: info.perHost ? t('consent.perhost', { host: info.host || '' }) : t('consent.change.hint') }),
              remember),
            actions: [{ label: t('consent.deny'), value: false }, { label: t('consent.allow'), variant: 'primary', value: true, primary: true }],
          });
          const allow = choice === true;
          this.log(t(allow ? 'consent.logged.allow' : 'consent.logged.deny', { purpose: t('consent.purpose.' + purpose) + (info.perHost && info.host ? ' (' + info.host + ')' : '') }), allow ? 'info' : 'warn');
          return { allow, remember: choice === undefined ? false : !!remember.checked };
        }

        /** Close side panels shown as sheets (narrow windows). */
        closeSheets() {
          for (const side of ['left', 'right']) if (this.el.getAttribute('data-' + side) === 'sheet') this.el.setAttribute('data-' + side, 'closed');
        }

        registerMode(mode) { this.modes.set(mode.id, mode); }
        /**
         * A mode whose scripts are a group loaded at first use (src/boot.js GROUPS): created when the group has run, at once
         * when it has already (the test page loads every group at start).
         * @param {string} id the mode's id @param {string} group the group's name @param {string} moduleName the module with createMode
         */
        registerLazyMode(id, group, moduleName) {
          this.lazyModes.set(id, { group, module: moduleName });
          if (D.groups.loaded(group)) this.loadMode(id).catch((err) => this.partFailed(err));
        }
        /**
         * The mode, its group loaded first for a lazy one; created synchronously when the group is loaded already.
         * @param {string} id
         * @returns {Promise<any>} the mode, or null for an unknown id
         */
        loadMode(id) {
          const lazy = this.lazyModes.get(id);
          if (this.modes.has(id) || !lazy) return Promise.resolve(this.modes.get(id) || null);
          return D.ensure([lazy.group], () => {
            if (!this.modes.has(id)) this.registerMode(D.require(lazy.module).createMode(this.ctx));
            return this.modes.get(id);
          });
        }

        async init() {
          // The very first start: let the user pick the language before anything else is shown.
          if (!i18n.hasChoice()) await this.chooseLanguage({ required: true });
          // The tier the user chose (platform/tier), before the first mode draws its entry points; later changes redraw.
          await tier.load();
          tier.subscribe(() => this.applyTier());
          this.assistantEl.hidden = !tier.shows('status:assistant');
          // The deployment's Dataregium server (dataspatium.config.js) becomes a source once; it is not contacted. The OpenCDE family
          // loads with the group 'families' (src/boot.js) only for a server not yet added.
          try {
            const server = tier.deployment().server;
            if (!(await D.require('api/connectors').deployedNoted(server))) await D.ensure(['families'], () => D.require('api/families/opencde').addDeployed(server));
          } catch (err) { D.log('shell', 'deployed server', err); }
          // Datasets from versions before short names get one, derived from their name.
          try { await datasets.ensureShortNames(); } catch (err) { D.log('shell', 'short names', err); }
          await this.reloadDatasets();
          this.updateStorage();
          await this.applyWidths();
          this.listenToFlows();
          // Land where the user most likely wants to be: an empty workspace starts in Inhämta, one with
          // datasets in Hantera. An explicit #/mode in the URL wins.
          // A mode loaded at first use is active once its group has run; the object of the route waits for that.
          const route = this.parseRoute();
          const landing = this.store.get().datasets.length ? 'hantera' : 'inhamta';
          const shown = this.activate(MODES.includes(route.mode) ? route.mode : landing);
          if (route.object) shown.then(() => this.openRoute(route)).catch((err) => D.log('shell', 'route', err));
          window.addEventListener('hashchange', () => {
            const r = this.parseRoute();
            if (!MODES.includes(r.mode)) return;
            const there = r.mode !== this.store.get().mode ? this.activate(r.mode) : Promise.resolve();
            if (r.object) there.then(() => this.openRoute(r)).catch((err) => D.log('shell', 'route', err));
          });
          this.course.autoStart();
          this.remindBackup();
          this.versionNotice();
          // An installed app (served from a web server, added to the home screen) asks the browser to keep its storage.
          if (!D.capabilities.isFileProtocol && matchMedia('(display-mode: standalone)').matches) {
            idb.requestPersist().catch(() => {});
            // It works without a network after the first use only with every file in the service worker's cache (sw-coi.js keeps
            // what was fetched), so it loads the groups of scripts too, once the page has settled: every group up to the deployment's
            // ceiling, those of a tier above the one in effect too, so that raising the tier works offline. The mobile app has its own page.
            setTimeout(() => { D.ensure(D.groups.list().map((g) => g.name).filter((name) => name !== 'mobile' && tier.groupAllowed(name))).catch((err) => D.log('shell', 'groups for use offline', err)); }, 5000);
          }
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
        /** The first dataset with comments not yet looked at, on its tab for them. */
        async openUnread() {
          const { first } = await D.require('data/collab').unread();
          if (!first) return;
          this.store.set({ selectedId: first, datasetTab: 'comments' });
          this.activate('hantera');
        }
        /** The address of a mode and an object, for copying and QR codes. */
        link(mode, object) {
          const base = location.href.replace(/#.*$/, '');
          return base + '#/' + mode + (object ? '/' + encodeURIComponent(object) : '');
        }
        /** Apply the object part of a route in the mode that is already active. */
        async openRoute(route) {
          const { mode, object } = route;
          // A lazy mode's group first: its views pick up what the route leaves in the store.
          await this.loadMode(mode);
          const state = this.store.get();
          const byName = (o) => state.datasets.find((d) => d.shortName === o || d.id === o || d.name === o) || null;
          // #/inhamta/opencde?server=https://…[&project=…&document=…&version=…] : a server (Dataregium's "Open in Dataspatium") lands in
          // the source dialog, filled in, or opens directly when it is a source already; a named project is chosen and a document fetched.
          if (mode === 'inhamta' && /^opencde(\?|$)/.test(object)) {
            const q = new URLSearchParams(object.split('?')[1] || '');
            const server = q.get('server');
            const version = q.get('version');
            if (server && /^https?:\/\//i.test(server)) {
              this.store.set({ pendingSource: { family: 'opencde', baseUrl: server, projectId: q.get('project') || null, documentId: q.get('document') || null, versionIndex: version && /^\d+$/.test(version) ? Number(version) : null, at: Date.now() } });
            }
          } else if (mode === 'soka') { this.store.set({ pendingSearch: { text: object, at: Date.now() } }); }
          else if (mode === 'visualisera') {
            const charts = await D.require('viz/charts').list();
            const chart = charts.find((c) => c.id === object || c.name === object);
            if (chart) this.store.set({ selectedId: chart.datasetId || state.selectedId, openChartId: chart.id });
            else { const ds = byName(object); if (ds) this.store.set({ selectedId: ds.id }); }
          } else { const ds = byName(object); if (ds) this.store.set({ selectedId: ds.id }); }
          this.hiddenByRoute(mode, byName(object));
          const wanted = '#/' + mode + '/' + encodeURIComponent(object);
          if (location.hash !== wanted) history.replaceState(null, '', wanted);
        }

        /**
         * A deep link to a dataset whose kind's own views the tier hides (platform/tier): Bearbeta, Kontrollera and Hantera say so
         * on the page, and Visualisera does for a chart of a hidden type; the other modes say so here, with a way to raise the tier,
         * or what caps it when the deployment does. The dataset opens as a table either way.
         * @param {string} mode @param {any} ds
         */
        hiddenByRoute(mode, ds) {
          if (!ds || ['bearbeta', 'kontrollera', 'hantera'].includes(mode) || !D.has('data/kinds') || D.require('data/kinds').shown(ds)) return;
          const feature = 'kind:' + ds.kind;
          const w = tier.why(feature);
          const text = tier.hiddenText(feature);
          this.log(text, 'info');
          const tierUi = D.require('ui/settings/tier');
          this.toast(text, { kind: 'info', timeout: 15000, action: w.canRaise ? { label: t('tier.raise', { tier: tierUi.nameOf(w.needs) }), onClick: () => { tierUi.choose(this.ctx, w.needs); } } : undefined });
        }

        /**
         * Switch mode. A lazy mode whose group has not run yet shows that it is loading and opens once the group has run,
         * unless another mode was asked for meanwhile; one whose group has run is created and opened at once. The address
         * becomes #/<mode>, except when the mode is only drawn again (`redraw`, a tier change): the browsers drop history calls
         * that come too often, and a redraw keeps a deep link's object in the address.
         * @param {string} id @param {{redraw?: boolean}} [options]
         * @returns {Promise<void>} resolved when the mode is active, or when the workspace says that it could not be loaded
         */
        activate(id, options = {}) {
          this.wanted = id;
          const lazy = this.lazyModes.get(id);
          if (lazy && !this.modes.has(id) && !D.groups.loaded(lazy.group)) {
            this.showModeLoading(id);
            if (this.pending && this.pending.id === id) return this.pending.done;
            const done = this.loadMode(id).then(
              () => { if (this.wanted === id) this.activate(id, options); },
              (err) => { if (this.wanted === id) this.showModeFailed(id, err); },
            ).finally(() => { if (this.pending && this.pending.id === id) this.pending = null; });
            this.pending = { id, done };
            return done;
          }
          if (lazy && !this.modes.has(id)) this.loadMode(id).catch((err) => this.partFailed(err));
          const mode = this.modes.get(id);
          if (!mode) return Promise.resolve();
          if (this.active && this.active.deactivate) this.active.deactivate();
          for (const slot of Object.values(this.slots)) slot.replaceChildren();
          this.active = mode;
          // The object panel is named after what the mode keeps there: the sources in Inhämta, the datasets elsewhere.
          const leftTitle = t(mode.leftTitle || 'shell.datasets');
          if (this.leftTitle) this.leftTitle.textContent = leftTitle;
          if (this.leftAside) this.leftAside.setAttribute('aria-label', leftTitle);
          this.store.set({ mode: id });
          for (const btn of this.modeNav.children) btn.setAttribute('aria-current', btn.getAttribute('data-mode') === id ? 'page' : 'false');
          if (!options.redraw && location.hash !== '#/' + id) history.replaceState(null, '', '#/' + id);
          mode.activate(this.slots);
          return Promise.resolve();
        }

        /** The workspace while a mode's group loads: the mode's name and that it is loading; the mode before is closed. */
        showModeLoading(id) {
          if (this.active && this.active.deactivate) this.active.deactivate();
          this.active = null;
          for (const slot of Object.values(this.slots)) slot.replaceChildren();
          this.slots.center.append(h('dm-empty-state', { icon: MODE_ICONS[id], heading: t('mode.' + id), text: t('common.loading'), role: 'status', 'data-mode-loading': id }, h('dm-progress', { indeterminate: '' })));
          // The modes loaded at first use keep the datasets in the object panel (only Inhämta, in the start, names it otherwise).
          if (this.leftTitle) this.leftTitle.textContent = t('shell.datasets');
          if (this.leftAside) this.leftAside.setAttribute('aria-label', t('shell.datasets'));
          for (const btn of this.modeNav.children) btn.setAttribute('aria-current', btn.getAttribute('data-mode') === id ? 'page' : 'false');
        }
        /** The workspace when a mode's group did not load: what happened and a way to try again. */
        showModeFailed(id, err) {
          console.error('[shell] mode ' + id + ' did not load', err);
          const text = err && err.path ? t('shell.part.failed', { file: err.path }) : String((err && err.message) || err);
          const heading = t('shell.mode.failed', { mode: t('mode.' + id) });
          this.log(heading + ': ' + text, 'error');
          replace(this.slots.center, h('dm-empty-state', { icon: 'triangle-alert', heading, text, 'data-mode-failed': id },
            basic.button({ label: t('shell.mode.retry'), icon: 'refresh-cw', variant: 'primary', title: t('shell.mode.retry.hint'), onClick: () => this.activate(id) })));
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

        /** Whether the shell's root was on the page and has left it since (an app that a test started and ended). */
        leftPage() {
          if (this.root.isConnected) this.wasOnPage = true;
          return this.wasOnPage && !this.root.isConnected;
        }

        async onDatasets(type, payload) {
          // A shell that has left the page no longer follows the datasets: each one read the whole list again at every change (LD-65).
          if (this.leftPage()) return;
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
          if (e.altKey && !e.ctrlKey && !e.metaKey && /^[1-9]$/.test(e.key)) { e.preventDefault(); this.activate(MODES[Number(e.key) - 1]); }
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
          if (tier.shows('command:assistant')) cmds.push({ id: 'assistant', label: t('assistant.title'), hint: t('assistant.open.hint'), group: t('palette.group.actions'), icon: 'sparkles', keywords: ['AI'], run: () => this.openAssistant() });
          cmds.push({ id: 'tier', label: t('tier.title'), hint: t('tier.' + tier.keyOf(tier.current())), group: t('palette.group.actions'), icon: 'layers', keywords: [t('tier.documents'), t('tier.bim-gis'), t('tier.experimental')], run: () => { this.activate('hantera'); this.store.set({ selectedId: '__workspace' }); } });
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
