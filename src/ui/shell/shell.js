// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Application shell: builds the fixed layout (top bar with the six modes, object panel, workspace,
 * inspector, log drawer), owns the store and hands each mode the same slots and services.
 *
 * Mode contract: { id, activate(slots), deactivate(), update?(state, changed) } created by
 * `createMode(ctx)` in src/ui/modes/*.js.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/shell', ['ui/components', 'ui/base', 'ui/icons', 'ui/basic', 'ui/overlays', 'ui/theme', 'ui/state', 'ui/dataset-list', 'data/datasets', 'data/workspace', 'io/import', 'io/export', 'platform/files', 'platform/storage/idb', 'ui/command-palette'],
    (_components, base, icons, basic, overlays, theme, stateMod, datasetList, datasets, workspace, importer, exporter, files, idb, paletteMod) => {
      const { h, t, i18n, replace } = base;
      const MODES = ['inhamta', 'hantera', 'bearbeta', 'analysera', 'visualisera', 'exportera'];
      const MODE_ICONS = { inhamta: 'download', hantera: 'database', bearbeta: 'wand-sparkles', analysera: 'terminal', visualisera: 'chart-column', exportera: 'file-output' };
      const THEME_ICON = { auto: 'sun', light: 'sun', dark: 'moon' };

      class Shell {
        /** @param {HTMLElement} root */
        constructor(root) {
          this.root = root;
          this.modes = new Map();
          this.active = null;
          this.store = stateMod.createStore({ mode: null, datasets: [], selectedId: null, status: 'saved' });
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
          this.statusEl = h('span', { class: 'dm-status', 'data-state': 'saved' }, icons.icon('circle-check', 14), h('span', { text: t('shell.status.saved') }));
          this.storageEl = h('span', { class: 'dm-status', text: '' });
          this.themeBtn = basic.button({ label: t('shell.theme'), icon: THEME_ICON[theme.get()], 'icon-only': true, variant: 'ghost', onClick: () => this.toggleTheme() });
          this.langBtn = basic.button({ label: t('lang.title'), icon: 'languages', 'icon-only': true, variant: 'ghost', onClick: () => this.chooseLanguage() });
          this.logList = h('ul', { class: 'dm-log', 'aria-live': 'polite' });
          this.slots.center.setAttribute('tabindex', '-1');
          this.el = h('div', { class: 'dm-shell', 'data-left': 'open', 'data-right': 'open', 'data-drawer': 'closed' },
            h('a', { class: 'dm-skip', href: '#dm-center', text: t('shell.skip'), onclick: (e) => { e.preventDefault(); this.slots.center.focus(); } }),
            h('header', { class: 'dm-topbar' },
              h('div', { class: 'dm-brand' }, icons.icon('layers', 18), h('span', { text: t('app.name') })),
              this.modeNav,
              h('div', { class: 'dm-topbar-right' },
                this.statusEl, this.storageEl,
                basic.button({ label: t('shell.toggle.left'), icon: 'panel-left', 'icon-only': true, variant: 'ghost', onClick: () => this.toggle('left') }),
                basic.button({ label: t('shell.toggle.right'), icon: 'panel-right', 'icon-only': true, variant: 'ghost', onClick: () => this.toggle('right') }),
                basic.button({ label: t('shell.toggle.drawer'), icon: 'panel-bottom', 'icon-only': true, variant: 'ghost', onClick: () => this.toggle('drawer') }),
                basic.button({ label: t('palette.open'), icon: 'search', 'icon-only': true, variant: 'ghost', onClick: () => this.palette.open() }),
                this.langBtn,
                this.themeBtn,
                basic.button({ label: t('shell.help'), icon: 'circle-help', 'icon-only': true, variant: 'ghost', onClick: () => this.showHelp() }))),
            h('aside', { class: 'dm-left', 'aria-label': t('shell.objects') }, h('div', { class: 'dm-pane-head' }, h('span', { text: t('shell.objects') })), this.slots.left),
            this.slots.center,
            h('aside', { class: 'dm-right', 'aria-label': t('shell.inspector') }, h('div', { class: 'dm-pane-head' }, h('span', { text: t('shell.inspector') })), this.slots.right),
            h('section', { class: 'dm-drawer', 'aria-label': t('shell.drawer') },
              h('div', { class: 'dm-pane-head' }, h('span', { text: t('shell.drawer') }), basic.button({ label: t('common.close'), icon: 'x', 'icon-only': true, size: 'sm', variant: 'ghost', onClick: () => this.toggle('drawer') })),
              this.logList));
          replace(this.root, this.el);
        }

        registerMode(mode) { this.modes.set(mode.id, mode); }

        async init() {
          // The very first start: let the user pick the language before anything else is shown.
          if (!i18n.hasChoice()) await this.chooseLanguage({ required: true });
          // Datasets from versions before short names get one, derived from their name.
          try { await datasets.ensureShortNames(); } catch (err) { D.log('shell', 'short names', err); }
          await this.reloadDatasets();
          this.updateStorage();
          // Land where the user most likely wants to be: an empty workspace starts in Inhämta, one with
          // datasets in Hantera. An explicit #/mode in the URL wins.
          const fromHash = (location.hash || '').replace(/^#\/?/, '');
          const landing = this.store.get().datasets.length ? 'hantera' : 'inhamta';
          this.activate(MODES.includes(fromHash) ? fromHash : landing);
          window.addEventListener('hashchange', () => { const id = (location.hash || '').replace(/^#\/?/, ''); if (MODES.includes(id) && id !== this.store.get().mode) this.activate(id); });
          this.remindBackup();
        }

        /** Once per start: a warning when the workspace has not been backed up within the interval set under Hantera. */
        async remindBackup() {
          try {
            const st = await workspace.backupStatus();
            if (!st.due) return;
            const message = st.lastAt ? t('backup.due', { days: st.daysSince }) : t('backup.due.never');
            this.log(message, 'warn');
            this.toast(message, {
              kind: 'warn', timeout: 15000,
              action: { label: t('backup.now'), onClick: async () => {
                try {
                  const { blob } = await workspace.backup();
                  files.download(blob, t('datasets.backup.file', { stamp: new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') }));
                  this.log(t('datasets.backup.done'), 'ok');
                } catch (err) { this.log(String((err && err.message) || err), 'error'); }
              } },
            });
          } catch (_err) { /* reminders are best effort */ }
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
          if (this.active && this.active.update && !changed.includes('mode')) this.active.update(state, changed);
        }

        async onDatasets(type, payload) {
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
          this.store.set({ datasets: list });
          return list;
        }

        async updateStorage() {
          const est = await idb.estimate();
          this.storageEl.textContent = est && est.usage ? t('shell.storage', { used: i18n.formatBytes(est.usage) }) : '';
        }

        toggle(which) {
          const key = 'data-' + which;
          const open = this.el.getAttribute(key) === 'open';
          this.el.setAttribute(key, open ? 'closed' : 'open');
        }

        onKey(e) {
          if (e.altKey && !e.ctrlKey && !e.metaKey && /^[1-6]$/.test(e.key)) { e.preventDefault(); this.activate(MODES[Number(e.key) - 1]); }
          else if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); this.palette.open(); }
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
              hint: t('common.rows', { n: i18n.formatNumber(d.rowCount || 0) }) + ' · ' + t('common.columns', { n: d.columnCount || 0 }),
              run: () => { this.store.set({ selectedId: d.id }); if (!this.store.get().mode || this.store.get().mode === 'inhamta') this.activate('bearbeta'); },
            });
          }
          // '__workspace' is the workspace entry's id in the Hantera dataset list (WORKSPACE in ui/modes/hantera).
          cmds.push({ id: 'workspace', label: t('datasets.storage.title'), hint: t('datasets.backup'), group: t('palette.group.actions'), icon: 'hard-drive', run: () => { this.activate('hantera'); this.store.set({ selectedId: '__workspace' }); } });
          cmds.push({ id: 'theme', label: t('shell.theme'), group: t('palette.group.actions'), icon: THEME_ICON[theme.get()], run: () => this.toggleTheme() });
          cmds.push({ id: 'help', label: t('shell.help'), hint: t('app.version', { version: D.version }), group: t('palette.group.actions'), icon: 'circle-help', run: () => this.showHelp() });
          cmds.push({ id: 'lang', label: t('lang.title'), hint: 'Svenska · Dansk · Norsk · Suomi · Íslenska · English', group: t('palette.group.actions'), icon: 'languages', run: () => this.chooseLanguage() });
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
          // The update check is the only network call the app makes on its own, and only on this click.
          const result = h('p', { class: 'dm-help dm-small' });
          const checkBtn = basic.button({ label: t('update.check'), icon: 'refresh-cw', size: 'sm', onClick: async () => {
            checkBtn.loading = true; result.textContent = t('update.checking');
            try {
              const res = await D.require('platform/updates').check();
              result.textContent = res.newer ? t('update.available', { version: res.latest }) + ' ' : t('update.latest', { version: res.current });
              if (res.newer) result.appendChild(h('a', { href: res.url, target: '_blank', rel: 'noopener', text: t('update.download') }));
            } catch (err) { result.textContent = String((err && err.message) || err); }
            checkBtn.loading = false;
          } });
          overlays.dialog.open({
            title: t('shell.help'),
            body: h('div', { class: 'dm-prose' },
              h('p', { text: t('app.tagline') }),
              h('ul', null, MODES.map((id) => h('li', null, h('strong', { text: t('mode.' + id) + ': ' }), t('mode.' + id + '.desc')))),
              h('p', { class: 'dm-help', text: t('app.version', { version: D.version }) + '. ' + t('shell.shortcuts') }),
              h('p', { class: 'dm-help' }, t('shell.help.docs') + ' ', h('a', { href: i18n.docsUrl(), target: '_blank', rel: 'noopener', text: t('shell.help.docs.link') })),
              h('div', { class: 'dm-row' }, checkBtn),
              result),
          });
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
