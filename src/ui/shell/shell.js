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
  D.define('ui/shell', ['ui/components', 'ui/base', 'ui/icons', 'ui/basic', 'ui/overlays', 'ui/theme', 'ui/state', 'ui/dataset-list', 'data/datasets', 'data/workspace', 'io/import', 'io/export', 'platform/files', 'platform/storage/idb'],
    (_components, base, icons, basic, overlays, theme, stateMod, datasetList, datasets, workspace, importer, exporter, files, idb) => {
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
          this.build();
          this.store.subscribe((state, changed) => this.onState(state, changed));
          datasets.subscribe((type, payload) => this.onDatasets(type, payload));
          document.addEventListener('keydown', (e) => this.onKey(e));
        }

        build() {
          this.slots = { left: h('div', { class: 'dm-pane-body' }), center: h('main', { class: 'dm-center', id: 'dm-center' }), right: h('div', { class: 'dm-pane-body' }) };
          this.modeNav = h('nav', { class: 'dm-modes', 'aria-label': 'Lägen' }, MODES.map((id) => h('button', {
            type: 'button', class: 'dm-mode-btn', 'data-mode': id, title: `${t('mode.' + id)} (Alt+${MODES.indexOf(id) + 1})`, onclick: () => this.activate(id),
          }, icons.icon(MODE_ICONS[id], 16), h('span', { text: t('mode.' + id) }))));
          this.statusEl = h('span', { class: 'dm-status', 'data-state': 'saved' }, icons.icon('circle-check', 14), h('span', { text: t('shell.status.saved') }));
          this.storageEl = h('span', { class: 'dm-status', text: '' });
          this.themeBtn = basic.button({ label: t('shell.theme'), icon: THEME_ICON[theme.get()], 'icon-only': true, variant: 'ghost', onClick: () => { const next = theme.cycle(); this.themeBtn.setAttribute('icon', THEME_ICON[next]); this.toast(t('shell.theme.' + next)); } });
          this.logList = h('ul', { class: 'dm-log', 'aria-live': 'polite' });
          this.el = h('div', { class: 'dm-shell', 'data-left': 'open', 'data-right': 'open', 'data-drawer': 'closed' },
            h('header', { class: 'dm-topbar' },
              h('div', { class: 'dm-brand' }, icons.icon('layers', 18), h('span', { text: t('app.name') })),
              this.modeNav,
              h('div', { class: 'dm-topbar-right' },
                this.statusEl, this.storageEl,
                basic.button({ label: t('shell.toggle.left'), icon: 'panel-left', 'icon-only': true, variant: 'ghost', onClick: () => this.toggle('left') }),
                basic.button({ label: t('shell.toggle.right'), icon: 'panel-right', 'icon-only': true, variant: 'ghost', onClick: () => this.toggle('right') }),
                basic.button({ label: t('shell.toggle.drawer'), icon: 'panel-bottom', 'icon-only': true, variant: 'ghost', onClick: () => this.toggle('drawer') }),
                this.themeBtn,
                basic.button({ label: t('shell.help'), icon: 'circle-help', 'icon-only': true, variant: 'ghost', onClick: () => this.showHelp() }))),
            h('aside', { class: 'dm-left' }, h('div', { class: 'dm-pane-head' }, h('span', { text: t('shell.objects') })), this.slots.left),
            this.slots.center,
            h('aside', { class: 'dm-right' }, h('div', { class: 'dm-pane-head' }, h('span', { text: t('shell.inspector') })), this.slots.right),
            h('section', { class: 'dm-drawer' },
              h('div', { class: 'dm-pane-head' }, h('span', { text: t('shell.drawer') }), basic.button({ label: t('common.close'), icon: 'x', 'icon-only': true, size: 'sm', variant: 'ghost', onClick: () => this.toggle('drawer') })),
              this.logList));
          replace(this.root, this.el);
        }

        registerMode(mode) { this.modes.set(mode.id, mode); }

        async init() {
          await this.reloadDatasets();
          this.updateStorage();
          // Land where the user most likely wants to be: an empty workspace starts in Inhämta, one with
          // datasets in Hantera. An explicit #/mode in the URL wins.
          const fromHash = (location.hash || '').replace(/^#\/?/, '');
          const landing = this.store.get().datasets.length ? 'hantera' : 'inhamta';
          this.activate(MODES.includes(fromHash) ? fromHash : landing);
          window.addEventListener('hashchange', () => { const id = (location.hash || '').replace(/^#\/?/, ''); if (MODES.includes(id) && id !== this.store.get().mode) this.activate(id); });
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
          await this.reloadDatasets();
          if (type === 'deleted' && this.store.get().selectedId === payload.id) this.store.set({ selectedId: null });
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
              h('div', { class: 'dm-row' }, checkBtn),
              result),
          });
        }
      }

      function create(root) { return new Shell(root); }
      return { create, MODES, MODE_ICONS };
    });
})();
