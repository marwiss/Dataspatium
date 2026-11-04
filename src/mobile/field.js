// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Collecting in the field on the phone: a form received from a computer, rows filled in offline with position and photos,
 * checked at once against the form and its rules, and carried back to the computer. A phone may drop the page when the
 * camera opens, so a row being filled in is a draft in IndexedDB from the first change and its photos are stored as soon
 * as they are taken. Rows stay on the phone until the user clears them; a row that has been sent can no longer be changed
 * here, because the computer recognises rows by their id and would skip a second copy.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('mobile/field', ['ui/base', 'ui/icons', 'ui/overlays', 'ui/basic', 'platform/storage/idb', 'platform/files', 'engines/sqlite', 'data/field-form'],
    (base, icons, overlays, basic, idb, files, sqlite, fieldForm) => {
      const { h, t, i18n, replace } = base;
      const { dialog, toast } = overlays;
      const icon = icons.icon;
      const button = basic.button;
      const rowsKey = (formId) => 'mobile.field.rows.' + formId;
      const draftKey = (formId) => 'mobile.field.draft.' + formId;
      const photoKey = (name) => 'mfield:' + name;
      const POSITION_OPTIONS = { enableHighAccuracy: true, timeout: 20000, maximumAge: 15000 };

      async function loadRows(formId) { return (await idb.getSetting(rowsKey(formId), [])) || []; }
      async function saveRows(formId, rows) { await idb.setSetting(rowsKey(formId), rows); }
      async function dropPhotos(photos) { for (const p of photos || []) await idb.deleteBlob(photoKey(p.name)); }

      /**
       * A photo no larger than the form asks for. Anything that cannot be scaled here is kept as it is.
       * @param {Blob} file @param {number} maxSide 0 keeps the original
       * @returns {Promise<{blob: Blob, type: string}>}
       */
      async function scalePhoto(file, maxSide) {
        const original = { blob: file, type: file.type || 'image/jpeg' };
        if (!maxSide) return original;
        try {
          const bitmap = await createImageBitmap(file);
          try {
            const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
            if (ratio >= 1 && /jpeg/.test(file.type || '')) return original;
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
            canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
            return blob ? { blob, type: 'image/jpeg' } : original;
          } finally { bitmap.close(); }
        } catch (err) { D.log('field', 'photo kept unscaled', err); return original; }
      }

      /**
       * Ask for every file the page has used through the service worker, so that it keeps them for use without a network.
       * @param {{urls?: string[], wait?: number}} [options] @returns {Promise<'ready'|'pending'|'local'>}
       */
      async function prepareOffline(options = {}) {
        if (location.protocol === 'file:' || !('serviceWorker' in navigator) || !('caches' in globalThis)) return 'local';
        const wait = options.wait === undefined ? 4000 : options.wait;
        if (!navigator.serviceWorker.controller) {
          await new Promise((resolve) => {
            const timer = setTimeout(resolve, wait);
            navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(timer); resolve(undefined); }, { once: true });
          });
        }
        if (!navigator.serviceWorker.controller) return 'pending';
        const here = location.href.split('#')[0];
        const used = performance.getEntriesByType('resource').map((e) => e.name).filter((url) => url.startsWith(location.origin) && !/\/inbox\//.test(url));
        const urls = options.urls || Array.from(new Set(used.concat([here, new URL('./', here).href])));
        let missing = 0;
        for (const url of urls) {
          try {
            await fetch(url, { credentials: 'same-origin' });
            let hit = await caches.match(url);
            for (let i = 0; i < 20 && !hit; i++) { await new Promise((r) => setTimeout(r, 50)); hit = await caches.match(url); }
            if (!hit) missing++;
          } catch (err) { D.log('field', 'not kept for offline use', url, err); missing++; }
        }
        return missing ? 'pending' : 'ready';
      }

      class Field {
        /**
         * @param {any} app the mobile app @param {{listBundles: () => Promise<any[]>, removeBundle: (id: string) => Promise<void>}} store
         */
        constructor(app, store) {
          this.app = app;
          this.store = store;
          this.bundle = null;
          this.form = null;
          this.rows = [];
          this.draft = null;
          this.edit = null;
          this.counts = new Map();
          this.engine = null;
          this.checker = null;
          this.offline = null;
          this.urls = [];
          this.els = null;
        }
        forms() { return this.app.state.bundles.filter((b) => b.kind === 'form'); }
        async refresh() {
          for (const b of this.forms()) {
            const rows = await loadRows(b.form.id);
            this.counts.set(b.form.id, { all: rows.length, unsent: rows.filter((r) => !r.sentAt).length });
          }
        }
        /** A form has arrived: the newest copy replaces an older one, rows stay, and the phone gets ready to work offline. */
        async adopt(meta) {
          if (meta.kind !== 'form') return;
          for (const b of this.forms()) if (b.id !== meta.id && b.form.id === meta.form.id) await this.store.removeBundle(b.id);
          this.app.state.bundles = await this.store.listBundles();
          await this.refresh();
          // A browser may ask the user about this and never answer until they do, so nothing waits for it.
          if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch((err) => D.log('field', 'persist', err));
          this.getReady();
        }
        /**
         * Everything the phone will need without a network: SQLite for the rules, then every file kept by the service worker.
         * A new version of the app brings an empty cache, so this runs at each start while there are forms on the phone.
         */
        getReady() {
          this.ensureEngine()
            .catch((err) => D.log('field', 'engine', err))
            .then(() => prepareOffline())
            .then((state) => { this.offline = state; if (this.app.state.screen === 'field') this.app.render(); })
            .catch((err) => D.log('field', 'offline', err));
        }

        // ---- the rules ----
        async ensureEngine() {
          if (!this.engine) { const engine = new sqlite.SqliteEngine(); await engine.start(); this.engine = engine; }
          return this.engine;
        }
        async ensureChecker() {
          if (this.checker && this.checker.formId === (this.form && this.form.id)) return this.checker;
          if (!this.form) return null;
          await this.ensureEngine();
          await this.engine.open();
          const checker = await fieldForm.createChecker(this.engine, this.form);
          this.checker = Object.assign(checker, { formId: this.form.id });
          return this.checker;
        }
        rowValues(values, row) {
          const p = fieldForm.positionNames(this.form);
          const position = row.position;
          return Object.assign({}, values, position ? { [p.lat]: position.lat, [p.lon]: position.lon, noggrannhet_m: position.accuracy } : {}, { [fieldForm.ID_COLUMN]: row.id, insamlad: row.createdAt, insamlad_av: this.deviceName() });
        }
        async checkRules(values, row) {
          if (!(this.form.rules || []).length) return [];
          try {
            const checker = await this.ensureChecker();
            const others = this.rows.filter((r) => r.id !== row.id).map((r) => this.rowValues(r.values, r));
            return await checker.check(this.rowValues(values, row), others);
          } catch (err) { D.log('field', 'rules left to the computer', err); return []; }
        }
        deviceName() { const id = this.app.state.identity; return (id && id.name) || ''; }

        // ---- opening ----
        async open(bundle) {
          this.bundle = bundle;
          this.form = bundle.form;
          this.checker = null;
          this.rows = await loadRows(this.form.id);
          this.draft = await idb.getSetting(draftKey(this.form.id), null);
          this.app.go('field');
          if (this.offline !== 'ready') this.getReady();
        }
        newRow(previous) {
          const raw = {};
          for (const f of this.form.fields) raw[f.name] = previous && f.sticky ? previous[f.name] : '';
          this.startEdit({ id: fieldForm.newId('rad'), createdAt: new Date().toISOString(), raw, position: null, photos: [], isNew: true });
          if (this.form.position !== 'off') this.getPosition();
        }
        openRow(row) {
          if (row.sentAt) { toast.show(t('field.row.locked'), { kind: 'info' }); return; }
          const raw = {};
          for (const f of this.form.fields) { const v = row.values[f.name]; raw[f.name] = v === null || v === undefined ? '' : v; }
          this.startEdit({ id: row.id, createdAt: row.createdAt, raw, position: row.position, photos: (row.photos || []).slice(), isNew: false });
        }
        resumeDraft() { if (this.draft) this.startEdit(this.draft); }
        startEdit(state) {
          this.clearUrls();
          this.edit = Object.assign({ showAll: false, touched: {}, accept: false, broken: [], positionBusy: false, positionError: '' }, state);
          this.app.go('fieldrow');
        }
        clearUrls() { for (const url of this.urls) URL.revokeObjectURL(url); this.urls = []; }
        async saveDraft() {
          const e = this.edit;
          if (!e) return;
          this.draft = { id: e.id, createdAt: e.createdAt, raw: e.raw, position: e.position, photos: e.photos, isNew: e.isNew };
          await idb.setSetting(draftKey(this.form.id), this.draft);
        }
        async clearDraft() { this.draft = null; await idb.setSetting(draftKey(this.form.id), null); }
        async discardRow() {
          const e = this.edit;
          if (!e) return;
          if (!(await dialog.confirm(t('field.row.discard.confirm'), { danger: true }))) return;
          const kept = new Set(((this.rows.find((r) => r.id === e.id) || {}).photos || []).map((p) => p.name));
          await dropPhotos(e.photos.filter((p) => !kept.has(p.name)));
          await this.clearDraft();
          this.edit = null;
          this.clearUrls();
          this.app.go('field');
        }
        async deleteRow() {
          const e = this.edit;
          if (!e) return;
          if (!(await dialog.confirm(t('field.row.delete.confirm'), { danger: true }))) return;
          await dropPhotos(e.photos);
          this.rows = this.rows.filter((r) => r.id !== e.id);
          await saveRows(this.form.id, this.rows);
          await this.clearDraft();
          await this.refresh();
          this.edit = null;
          this.clearUrls();
          this.app.go('field');
        }

        // ---- position and photos ----
        getPosition() {
          const e = this.edit;
          if (!e) return;
          const geo = this.app.options.geolocation || navigator.geolocation;
          if (!geo) { e.positionError = t('field.position.unsupported'); this.showPosition(); return; }
          e.positionBusy = true; e.positionError = '';
          this.showPosition();
          geo.getCurrentPosition((p) => {
            e.positionBusy = false;
            e.position = { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy, time: new Date(p.timestamp || Date.now()).toISOString() };
            this.showPosition();
            this.changed();
          }, (err) => {
            e.positionBusy = false;
            e.positionError = t(err && err.code === 1 ? 'field.position.denied' : err && err.code === 3 ? 'field.position.timeout' : 'field.position.unavailable');
            this.showPosition();
          }, POSITION_OPTIONS);
        }
        /** @param {Iterable<File>} picked */
        async addPhotos(picked) {
          const e = this.edit;
          if (!e) return;
          for (const file of picked) {
            if (e.photos.length >= (this.form.maxPhotos || 5)) { toast.show(t('field.photo.max', { n: this.form.maxPhotos || 5 }), { kind: 'warn' }); break; }
            const scaled = await scalePhoto(file, this.form.photoMaxSide === undefined ? 2048 : this.form.photoMaxSide);
            const taken = (e.photoSeq = (e.photoSeq || 0) + 1);
            const name = `${e.id}-${e.photos.length + 1}-${taken}.jpg`;
            await idb.saveBlob(photoKey(name), await scaled.blob.arrayBuffer());
            e.photos.push({ name, size: scaled.blob.size, type: scaled.type });
          }
          await this.changed();
          this.showPhotos();
        }
        async removePhoto(name) {
          const e = this.edit;
          if (!e) return;
          e.photos = e.photos.filter((p) => p.name !== name);
          e.removed = (e.removed || []).concat([name]);
          await this.changed();
          this.showPhotos();
        }
        pickPhotos() {
          const input = /** @type {HTMLInputElement} */ (h('input', { type: 'file', accept: 'image/*', capture: 'environment', multiple: '', hidden: '' }));
          input.addEventListener('change', () => { this.addPhotos(Array.from(input.files || [])).catch((err) => this.app.fail(err)); });
          input.click();
        }

        // ---- checking and saving ----
        changed() {
          const e = this.edit;
          if (!e) return Promise.resolve();
          e.accept = false; e.broken = [];
          this.showErrors();
          return this.saveDraft();
        }
        check() {
          const e = this.edit;
          return fieldForm.validate(this.form, e.raw, { position: e.position, photos: e.photos.length });
        }
        showErrors() {
          const e = this.edit; const els = this.els;
          if (!e || !els) return;
          const res = this.check();
          for (const f of this.form.fields) {
            const shown = e.showAll || e.touched[f.name];
            const broken = e.broken.find((r) => r.columns && r.columns.includes(f.name));
            const message = (shown && res.errors[f.name]) || (broken && broken.text) || '';
            const el = els.errors[f.name];
            if (el) { el.textContent = message; el.hidden = !message; }
            if (els.inputs[f.name]) els.inputs[f.name].toggleAttribute('data-invalid', !!message);
          }
          if (els.positionError) { const m = e.showAll ? res.errors.__position || '' : ''; els.positionError.textContent = m; els.positionError.hidden = !m; }
          if (els.photoError) { const m = e.showAll ? res.errors.__photo || '' : ''; els.photoError.textContent = m; els.photoError.hidden = !m; }
          if (els.rules) {
            const other = e.broken.filter((r) => !(r.columns && r.columns.some((c) => this.form.fields.some((f) => f.name === c))));
            replace(els.rules, other.map((r) => h('p', { class: 'dm-field-error', role: 'alert', text: r.text })));
          }
          if (els.acceptNote) els.acceptNote.hidden = !e.accept;
        }
        /**
         * Validate and keep the row. Errors in the form stop it; a broken rule stops it once, and a second press keeps the
         * row with the rule noted, since the person standing in the field may know better than the rule.
         * @param {boolean} [another] start a new row afterwards
         */
        async saveRow(another) {
          const e = this.edit;
          if (!e || e.saving) return;
          e.saving = true;
          try {
            e.showAll = true;
            const res = this.check();
            this.showErrors();
            if (!res.ok) { toast.show(t('field.err.fix'), { kind: 'warn' }); return; }
            const row = { id: e.id, createdAt: e.createdAt, updatedAt: new Date().toISOString(), values: res.values, position: e.position, photos: e.photos.slice(), warnings: [] };
            const broken = await this.checkRules(res.values, row);
            if (broken.length && !e.accept) {
              e.broken = broken; e.accept = true;
              this.showErrors();
              toast.show(t('field.err.rules', { n: broken.length }), { kind: 'warn' });
              return;
            }
            row.warnings = broken.map((r) => r.id);
            const at = this.rows.findIndex((r) => r.id === row.id);
            if (at >= 0) this.rows[at] = row; else this.rows.unshift(row);
            await saveRows(this.form.id, this.rows);
            await dropPhotos((e.removed || []).map((name) => ({ name })));
            await this.clearDraft();
            await this.refresh();
            this.clearUrls();
            this.edit = null;
            toast.show(t('field.row.saved'), { kind: 'ok' });
            if (another) this.newRow(res.values); else this.app.go('field');
          } finally { e.saving = false; }
        }

        // ---- sending ----
        async packages(rows) {
          const parts = fieldForm.batches(rows);
          const out = [];
          for (let i = 0; i < parts.length; i++) {
            const pack = await fieldForm.packRows(this.form, parts[i], (name) => idb.loadBlob(photoKey(name)), { device: this.deviceName(), part: i + 1, parts: parts.length });
            out.push({ id: 'fb' + Date.now().toString(36) + i, name: pack.name, type: 'application/zip', data: pack.blob, kind: 'field', rowIds: parts[i].map((r) => r.id) });
          }
          return out;
        }
        async markSent(formId, rowIds) {
          const ids = new Set(rowIds);
          const now = new Date().toISOString();
          const rows = await loadRows(formId);
          for (const r of rows) if (ids.has(r.id)) r.sentAt = now;
          await saveRows(formId, rows);
          if (this.form && this.form.id === formId) this.rows = rows;
          await this.refresh();
        }
        /** @param {{all?: boolean}} [options] */
        async send(options = {}) {
          const form = this.form;
          const pending = options.all ? this.rows : this.rows.filter((r) => !r.sentAt);
          if (!pending.length) { toast.show(t('field.send.none'), { kind: 'info' }); return; }
          const build = async () => {
            const items = await this.packages(pending);
            return { items, done: (res) => this.markSent(form.id, items.filter((it) => res.confirmed.includes(it.id)).flatMap((it) => it.rowIds)) };
          };
          const session = this.app.state.session;
          if (session && session.state === 'connected') {
            const built = await build();
            const res = await this.app.sendItems(built.items);
            if (res) await built.done(res);
            this.app.go('field');
            return;
          }
          this.app.state.queue = [{ title: form.title, name: form.title, build }];
          toast.show(t('mobile.queue.hint'), { kind: 'info' });
          this.app.go('start');
        }
        /** The rows as files through the system's share sheet, or as downloads where there is none. */
        async shareFile() {
          const pending = this.rows.filter((r) => !r.sentAt);
          const rows = pending.length ? pending : this.rows;
          if (!rows.length) { toast.show(t('field.send.none'), { kind: 'info' }); return; }
          const items = await this.packages(rows);
          const list = items.map((it) => new File([it.data], it.name, { type: it.type }));
          if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: list })) {
            try {
              await navigator.share({ files: list, title: this.form.title });
              await this.markSent(this.form.id, rows.map((r) => r.id));
              this.app.render();
            } catch (err) { if (!err || err.name !== 'AbortError') this.app.fail(err); }
            return;
          }
          for (const file of list) files.download(file, file.name);
          toast.show(t('field.file.saved'), { kind: 'ok' });
        }
        async clearSent() {
          const sent = this.rows.filter((r) => r.sentAt);
          if (!sent.length) return;
          if (!(await dialog.confirm(t('field.clear.confirm', { n: i18n.formatNumber(sent.length) }), { danger: true }))) return;
          for (const r of sent) await dropPhotos(r.photos);
          this.rows = this.rows.filter((r) => !r.sentAt);
          await saveRows(this.form.id, this.rows);
          await this.refresh();
          this.app.render();
        }
        async removeForm() {
          const unsent = this.rows.filter((r) => !r.sentAt).length;
          const text = unsent ? t('field.form.delete.unsent', { n: i18n.formatNumber(unsent) }) : t('field.form.delete.confirm');
          if (!(await dialog.confirm(text, { danger: true }))) return;
          for (const r of this.rows) await dropPhotos(r.photos);
          if (this.draft) await dropPhotos(this.draft.photos);
          await saveRows(this.form.id, []);
          await this.clearDraft();
          await this.store.removeBundle(this.bundle.id);
          this.app.state.bundles = await this.store.listBundles();
          this.form = null; this.bundle = null; this.rows = [];
          this.app.go('start');
        }

        // ---- screens ----
        title() {
          if (this.app.state.screen === 'fieldrow') return t(this.edit && !this.edit.isNew ? 'field.row.edit' : 'field.row.new');
          return this.form ? this.form.title : t('field.title');
        }
        /** The card on the start page; only there when a form has arrived. */
        startCard() {
          const forms = this.forms();
          if (!forms.length) return null;
          return h('section', { class: 'dm-m-card' }, h('h2', { text: t('field.title') }),
            h('div', { class: 'dm-m-list' }, forms.map((b) => {
              const c = this.counts.get(b.form.id) || { all: 0, unsent: 0 };
              return this.app.item(icon('smartphone', 20), b.form.title, t('field.form.sub', { n: i18n.formatNumber(c.all), unsent: i18n.formatNumber(c.unsent) }), () => this.open(b).catch((err) => this.app.fail(err)));
            })));
        }
        rowSummary(row) {
          const parts = [];
          for (const f of this.form.fields) {
            const v = row.values[f.name];
            if (v === null || v === undefined || v === '') continue;
            const option = (f.options || []).find((o) => String(o.value) === String(v));
            parts.push(option ? option.label : f.type === 'boolean' ? t(v ? 'field.yes' : 'field.no') : String(v));
            if (parts.length === 2) break;
          }
          return parts.join(' · ') || t('field.row.empty');
        }
        rowSub(row) {
          const parts = [i18n.formatDateTime(row.createdAt)];
          if (row.position) parts.push(t('field.row.position'));
          if (row.photos && row.photos.length) parts.push(t('field.row.photos', { n: row.photos.length }));
          if (row.warnings && row.warnings.length) parts.push(t('field.row.warnings'));
          parts.push(row.sentAt ? t('field.row.sent') : t('field.row.unsent'));
          return parts.join(' · ');
        }
        formScreen() {
          const form = this.form;
          if (!form) return [];
          const unsent = this.rows.filter((r) => !r.sentAt).length;
          const sent = this.rows.length - unsent;
          const notice = this.offline === 'ready' ? h('p', { class: 'dm-m-status', 'data-state': 'connected', text: t('field.offline.ready') })
            : this.offline === 'pending' ? h('p', { class: 'dm-m-queue', text: t('field.offline.pending') }) : null;
          const start = h('section', { class: 'dm-m-card' },
            form.instructions ? h('p', { text: form.instructions }) : null,
            notice,
            h('div', { class: 'dm-m-actions' },
              this.draft ? button({ label: t('field.draft.resume'), icon: 'pencil', variant: 'primary', title: t('field.draft.hint'), onClick: () => this.resumeDraft() }) : null,
              button({ label: t('field.row.add'), icon: 'plus', variant: this.draft ? 'default' : 'primary', onClick: () => this.newRow() })));
          const list = this.rows.length
            ? h('div', { class: 'dm-m-list' }, this.rows.map((r) => this.app.item(icon(r.sentAt ? 'circle-check' : 'file', 20), this.rowSummary(r), this.rowSub(r), () => this.openRow(r))))
            : h('p', { class: 'dm-help', text: t('field.rows.none') });
          const send = h('section', { class: 'dm-m-card' },
            h('h2', { text: t('field.rows.title', { n: i18n.formatNumber(this.rows.length) }) }), list,
            this.rows.length ? h('div', { class: 'dm-m-actions' },
              button({ label: t('field.send', { n: i18n.formatNumber(unsent) }), icon: 'upload', disabled: !unsent, title: t('field.send.hint'), onClick: () => this.send().catch((err) => this.app.fail(err)) }),
              button({ label: t('field.share'), icon: 'share-2', title: t('field.share.hint'), onClick: () => this.shareFile().catch((err) => this.app.fail(err)) }),
              sent ? button({ label: t('field.send.again'), icon: 'upload', variant: 'ghost', title: t('field.send.again.hint'), onClick: () => this.send({ all: true }).catch((err) => this.app.fail(err)) }) : null,
              sent ? button({ label: t('field.clear', { n: i18n.formatNumber(sent) }), icon: 'trash-2', variant: 'ghost', title: t('field.clear.hint'), onClick: () => this.clearSent().catch((err) => this.app.fail(err)) }) : null) : null);
          const more = h('section', { class: 'dm-m-card' },
            h('details', { class: 'dm-more' }, h('summary', { text: t('field.form.more') }),
              (form.leftToComputer || []).length ? h('div', { class: 'dm-stack-xs' }, h('p', { class: 'dm-help', text: t('field.form.left') }), h('ul', null, form.leftToComputer.map((x) => h('li', { class: 'dm-help', text: x })))) : null,
              h('div', { class: 'dm-m-actions' }, button({ label: t('field.form.delete'), icon: 'trash-2', variant: 'danger', onClick: () => this.removeForm().catch((err) => this.app.fail(err)) }))));
          return [start, send, more];
        }
        inputFor(field, els) {
          const e = this.edit;
          const label = field.required ? `${field.label} *` : field.label;
          const help = field.description || null;
          let control;
          if (field.type === 'boolean' || (field.options && field.options.length)) {
            const options = field.type === 'boolean' && !(field.options && field.options.length)
              ? [{ value: 'true', label: t('field.yes') }, { value: 'false', label: t('field.no') }]
              : field.options.map((o) => ({ value: String(o.value), label: o.label }));
            control = /** @type {any} */ (h('dm-select', { label, help }));
            control.options = [{ value: '', label: t('field.choose') }].concat(options);
            const current = e.raw[field.name];
            control.value = current === null || current === undefined ? '' : String(current);
            control.addEventListener('change', () => { e.raw[field.name] = control.value; e.touched[field.name] = true; this.changed(); });
          } else {
            const kind = field.type === 'date' ? 'date' : field.type === 'datetime' ? 'datetime-local' : field.long ? 'textarea' : 'text';
            const attrs = { type: kind, label, help };
            if (field.long) attrs.rows = '3';
            if (field.type === 'integer') attrs.inputmode = 'numeric';
            if (field.type === 'number') attrs.inputmode = 'decimal';
            control = /** @type {any} */ (h('dm-input', attrs));
            control.value = e.raw[field.name];
            control.addEventListener('input', () => { e.raw[field.name] = control.value; this.changed(); });
            control.addEventListener('change', () => { e.touched[field.name] = true; this.showErrors(); });
          }
          control.setAttribute('data-field', field.name);
          els.inputs[field.name] = control;
          const error = h('p', { class: 'dm-field-error', role: 'alert', hidden: '' });
          els.errors[field.name] = error;
          return h('div', { class: 'dm-stack-xs' }, control, error);
        }
        positionText() {
          const e = this.edit;
          if (e.positionBusy) return t('field.position.busy');
          if (e.positionError) return e.positionError;
          if (!e.position) return t(this.form.position === 'required' ? 'field.position.needed' : 'field.position.none');
          return t('field.position.value', { lat: i18n.formatNumber(Number(e.position.lat.toFixed(5))), lon: i18n.formatNumber(Number(e.position.lon.toFixed(5))), m: i18n.formatNumber(Math.round(e.position.accuracy || 0)) });
        }
        showPosition() { if (this.els && this.els.position) this.els.position.textContent = this.positionText(); }
        async showPhotos() {
          const e = this.edit; const els = this.els;
          if (!e || !els || !els.photos) return;
          this.clearUrls();
          const items = [];
          for (const p of e.photos) {
            const bytes = await idb.loadBlob(photoKey(p.name));
            if (!bytes) continue;
            const url = URL.createObjectURL(new Blob([bytes], { type: p.type || 'image/jpeg' }));
            this.urls.push(url);
            items.push(h('div', { class: 'dm-m-photo' }, h('img', { src: url, alt: t('field.photo.alt') }),
              button({ label: t('field.photo.remove'), icon: 'x', 'icon-only': true, size: 'sm', onClick: () => this.removePhoto(p.name).catch((err) => this.app.fail(err)) })));
          }
          replace(els.photos, items);
          if (els.photoButton) els.photoButton.disabled = e.photos.length >= (this.form.maxPhotos || 5);
        }
        rowScreen() {
          const e = this.edit;
          if (!e) return this.formScreen();
          const form = this.form;
          const els = { inputs: {}, errors: {}, rules: h('div', { class: 'dm-stack-xs' }), acceptNote: h('p', { class: 'dm-m-queue', hidden: '', text: t('field.rules.accept') }) };
          this.els = els;
          const sections = [h('section', { class: 'dm-m-card' }, form.fields.map((f) => this.inputFor(f, els)), els.rules, els.acceptNote)];
          if (form.position !== 'off') {
            els.position = h('p', { class: 'dm-help', 'data-position': '', text: this.positionText() });
            els.positionError = h('p', { class: 'dm-field-error', role: 'alert', hidden: '' });
            sections.push(h('section', { class: 'dm-m-card' }, h('h2', { text: t('field.position') }), els.position, els.positionError,
              h('div', { class: 'dm-m-actions' }, button({ label: t('field.position.get'), icon: 'map-pin', title: t('field.position.hint'), onClick: () => this.getPosition() }))));
          }
          if (form.photo !== 'off') {
            els.photos = h('div', { class: 'dm-m-photos' });
            els.photoError = h('p', { class: 'dm-field-error', role: 'alert', hidden: '' });
            els.photoButton = button({ label: t('field.photo.add'), icon: 'image', title: t('field.photo.hint'), onClick: () => this.pickPhotos() });
            sections.push(h('section', { class: 'dm-m-card' }, h('h2', { text: t('field.photos') }), els.photos, els.photoError, h('div', { class: 'dm-m-actions' }, els.photoButton)));
            this.showPhotos().catch((err) => D.log('field', 'photos', err));
          }
          sections.push(h('section', { class: 'dm-m-card' }, h('div', { class: 'dm-m-actions' },
            button({ label: t('field.save.next'), icon: 'plus', variant: 'primary', onClick: () => this.saveRow(true).catch((err) => this.app.fail(err)) }),
            button({ label: t('common.save'), icon: 'check', onClick: () => this.saveRow(false).catch((err) => this.app.fail(err)) }),
            e.isNew ? button({ label: t('field.row.discard'), icon: 'x', variant: 'ghost', onClick: () => this.discardRow().catch((err) => this.app.fail(err)) })
              : button({ label: t('field.row.delete'), icon: 'trash-2', variant: 'danger', onClick: () => this.deleteRow().catch((err) => this.app.fail(err)) }))));
          setTimeout(() => this.showErrors(), 0);
          return sections;
        }
        /** Leaving a row keeps the draft; the form page offers to carry on. */
        back() {
          this.els = null;
          if (this.app.state.screen === 'fieldrow') {
            const keep = this.edit;
            this.clearUrls();
            this.edit = null;
            const go = () => this.app.go('field');
            if (keep) this.saveDraftOf(keep).then(go, go); else go();
            return;
          }
          this.form = null; this.bundle = null;
          this.refresh().then(() => this.app.go('start'), () => this.app.go('start'));
        }
        async saveDraftOf(e) { const was = this.edit; this.edit = e; await this.saveDraft(); this.edit = was; }
        destroy() { this.clearUrls(); if (this.engine) { this.engine.terminate(); this.engine = null; } }
      }

      return { Field, scalePhoto, prepareOffline, loadRows, saveRows, rowsKey, draftKey, photoKey };
    });
})();
