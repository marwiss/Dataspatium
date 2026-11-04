// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Dataspatium Mobil: the phone side of direct transfer (m/index.html). Roles: courier (carry a bundle from one
 * computer to another), receiver (keep what a computer sends), viewer (the tables inside a bundle) and forwarder
 * (hand a bundle on through the system share sheet, a download or another computer). Collecting in the field is in
 * mobile/field. It loads through the mobile
 * profile of src/boot.js and keeps received files in IndexedDB (a settings list plus one blob per file).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('mobile/app', ['ui/base', 'ui/components', 'ui/icons', 'ui/overlays', 'ui/basic', 'ui/fonts', 'ui/theme', 'platform/p2p', 'ui/qr', 'platform/storage/idb', 'platform/storage/zip', 'platform/files', 'engines/sqlite', 'mobile/field'],
    (base, _components, icons, overlays, basic, fonts, _theme, p2p, qr, idb, zip, files, sqlite, fieldMod) => {
      const { h, t, i18n, replace } = base;
      const { dialog, toast } = overlays;
      const icon = icons.icon;
      const button = basic.button;
      const BUNDLES = 'mobile.bundles';
      const INBOX = 'dataspatium-inbox';
      const PAGE = 50;
      const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';

      // ---- storage of received files ----
      async function listBundles() { return (await idb.getSetting(BUNDLES, [])) || []; }
      async function saveBundles(list) { await idb.setSetting(BUNDLES, list); }
      async function loadBlob(id) { const bytes = await idb.loadBlob('mbundle:' + id); return bytes ? new Blob([bytes]) : null; }
      async function removeBundle(id) { await idb.deleteBlob('mbundle:' + id); await saveBundles((await listBundles()).filter((b) => b.id !== id)); }

      /** What a received file is: a Dataspatium bundle (with its manifest read) or a plain file. */
      async function describe(blob, name) {
        const meta = { id: 'b_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), name, title: '', size: blob.size, type: blob.type || '', receivedAt: new Date().toISOString(), kind: 'file', datasets: [], message: '', author: '', from: '', counts: null };
        if (/\.zip$/i.test(name) || /zip/.test(blob.type)) {
          try {
            const entries = await zip.readZip(blob);
            if (entries['manifest.json']) {
              const manifest = JSON.parse(zip.text(entries['manifest.json']));
              if (manifest.kind === 'field-form' && manifest.form) { meta.kind = 'form'; meta.title = manifest.form.title || manifest.name || ''; meta.form = manifest.form; meta.datasets = []; return meta; }
              meta.kind = 'bundle';
              meta.title = manifest.name || '';
              meta.author = manifest.author || '';
              meta.message = manifest.message || '';
              meta.datasets = (manifest.datasets || []).filter((d) => d.file && entries[d.file]).map((d) => ({ id: d.id, name: d.name, rowCount: d.rowCount || 0, columnCount: d.columnCount || 0, file: d.file, folder: d.folder || '' }));
              meta.counts = { charts: (manifest.charts || []).length, dashboards: (manifest.dashboards || []).length, documents: (manifest.documents || []).length, notebooks: (manifest.notebooks || []).length };
            }
          } catch (err) { D.log('mobile', 'not a bundle', name, err); }
        }
        return meta;
      }
      /** Keep a received file: the blob in IndexedDB, the description first in the list. */
      async function keep(blob, name, from) {
        const meta = await describe(blob, name);
        meta.from = from || '';
        await idb.saveBlob('mbundle:' + meta.id, await blob.arrayBuffer());
        const list = await listBundles();
        list.unshift(meta);
        await saveBundles(list);
        return meta;
      }
      /** Files shared into the page by the system share sheet (Web Share Target; sw-coi.js parks them in a cache). */
      async function drainInbox() {
        if (!('caches' in globalThis)) return [];
        const out = [];
        try {
          const cache = await caches.open(INBOX);
          for (const req of await cache.keys()) {
            const res = await cache.match(req);
            if (!res) continue;
            let name = 'fil';
            try { name = decodeURIComponent(res.headers.get('X-Name') || 'fil'); } catch (_err) { /* keep */ }
            out.push(await keep(await res.blob(), name, t('mobile.from.share')));
            await cache.delete(req);
          }
        } catch (err) { D.log('mobile', 'inbox', err); }
        return out;
      }

      /** A dataset file inside a bundle, opened read-only for viewing: columns, a row count and paged reads. */
      async function openDataset(blob, entryPath) {
        const entries = await zip.readZip(blob);
        const bytes = entries[entryPath];
        if (!bytes) throw new Error(t('mobile.err.missing', { file: entryPath }));
        const engine = new sqlite.SqliteEngine();
        await engine.start();
        await engine.open(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
        const colRes = await engine.exec('select name, type, label from _columns order by position');
        const columns = colRes[0] ? colRes[0].values.map((r) => ({ name: String(r[0]), type: String(r[1] || 'text'), label: r[2] ? String(r[2]) : '' })) : [];
        const totalRes = await engine.exec('select count(*) from data');
        const total = totalRes[0] ? Number(totalRes[0].values[0][0]) : 0;
        const where = (filter) => (filter ? { sql: ' where ' + columns.map((c) => `cast(${q(c.name)} as text) like ?`).join(' or '), params: columns.map(() => '%' + filter + '%') } : { sql: '', params: [] });
        return {
          columns, total,
          async rows(offset, limit, filter) {
            const w = where(filter);
            const res = await engine.exec(`select ${columns.map((c) => q(c.name)).join(', ')} from data${w.sql} limit ${Number(limit) || PAGE} offset ${Number(offset) || 0}`, w.params);
            return res[0] ? res[0].values : [];
          },
          async count(filter) {
            if (!filter) return total;
            const w = where(filter);
            const res = await engine.exec(`select count(*) from data${w.sql}`, w.params);
            return res[0] ? Number(res[0].values[0][0]) : 0;
          },
          close() { engine.terminate(); },
        };
      }

      class Mobile {
        /** @param {HTMLElement} root @param {{hash?: string, certificate?: RTCCertificate}} options */
        constructor(root, options) {
          this.root = root;
          this.options = options || {};
          this.state = { screen: 'start', bundles: [], session: null, bundle: null, view: null, page: 0, filter: '', identity: null, queue: [], scanning: null, transfers: [] };
          this.qrEl = null; this.qrFor = null; this.filterTimer = 0; this.transferBox = null; this.destroyed = false;
          this.field = new fieldMod.Field(this, { listBundles, removeBundle });
        }
        async init() {
          document.documentElement.lang = i18n.language();
          try { this.state.identity = await p2p.identity(); } catch (err) { D.log('mobile', 'identity', err); }
          this.state.bundles = await listBundles();
          const inbox = await drainInbox();
          if (inbox.length) { this.state.bundles = await listBundles(); toast.show(t('mobile.inbox.received', { n: inbox.length }), { kind: 'ok' }); }
          for (const meta of inbox) await this.field.adopt(meta);
          await this.field.refresh();
          if (this.field.forms().length) this.field.getReady();
          const hash = this.options.hash !== undefined ? this.options.hash : location.hash;
          const m = /#o=([A-Za-z0-9_-]+)/.exec(hash || '');
          if (m) await this.connectTo(m[1]); else this.render();
          if (this.options.hash === undefined) window.addEventListener('hashchange', () => { const mm = /#o=([A-Za-z0-9_-]+)/.exec(location.hash); if (mm) this.connectTo(mm[1]).catch(() => {}); });
        }
        go(screen) { this.state.screen = screen; this.render(); }
        back() {
          const s = this.state;
          if (s.screen === 'field' || s.screen === 'fieldrow') { this.field.back(); return; }
          if (s.screen === 'dataset') { if (s.view) { s.view.close(); s.view = null; } this.go('bundle'); return; }
          if (s.screen === 'connect') { this.closeSession(); }
          this.stopScan();
          this.go('start');
        }
        subtitle(b) {
          const date = i18n.formatDateTime(b.receivedAt);
          const size = i18n.formatBytes(b.size);
          const main = b.kind === 'bundle' ? t('mobile.sub.bundle', { n: i18n.formatNumber(b.datasets.length), size, date }) : t('mobile.sub.file', { size, date });
          return b.from ? main + ' · ' + t('mobile.from', { name: b.from }) : main;
        }
        item(ic, name, sub, onClick) {
          const btn = h('button', { class: 'dm-m-item', type: 'button' }, ic, h('span', { class: 'dm-m-item-text' }, h('span', { class: 'dm-m-item-name', text: name }), h('span', { class: 'dm-m-item-sub', text: sub })), icon('chevron-right', 18));
          btn.addEventListener('click', onClick);
          return btn;
        }

        // ---- connection ----
        closeSession() { if (this.state.session) { try { this.state.session.close(); } catch (_err) { /* ignore */ } } this.state.session = null; this.qrEl = null; this.qrFor = null; }
        async connectTo(code) {
          this.stopScan();
          this.closeSession();
          const session = p2p.answer(code, { certificate: this.options.certificate });
          this.state.session = session;
          this.state.transfers = [];
          this.state.screen = 'connect';
          session.on('state', () => this.render());
          session.on('answer', () => this.render());
          session.on('hello', () => { this.render(); if (this.state.queue.length && session.state === 'connected') this.sendQueued().catch((err) => this.fail(err)); });
          session.on('error', (err) => { this.fail(err); });
          session.on('offer', (o) => this.onOffer(session, o).catch((err) => this.fail(err)));
          session.on('progress', (p) => this.onProgress(p));
          session.on('item', (item) => this.onItem(session, item).catch((err) => this.fail(err)));
          session.on('delivered', (msg) => { const row = this.state.transfers.find((x) => x.id === msg.id && x.direction === 'out'); if (row) { row.done = !!msg.ok; this.renderTransfers(); } });
          session.on('paired', () => { toast.show(t('mobile.paired'), { kind: 'ok' }); this.render(); });
          if (this.options.hash === undefined && /#o=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
          this.render();
          return session;
        }
        fail(err) { const msg = (err && err.message) || String(err); D.log('mobile', msg); toast.show(msg, { kind: 'error' }); this.render(); }
        statusText(session) {
          switch (session.state) {
            case 'new': case 'gathering': return t('mobile.status.preparing');
            case 'connecting': return t('mobile.status.connecting');
            case 'connected': return t('mobile.status.connected', { name: (session.peerInfo && session.peerInfo.name) || (session.remote && session.remote.name) || '…' });
            case 'disconnected': case 'closed': return t('mobile.status.closed');
            case 'failed': return t('mobile.status.failed', { error: session.error || '' });
            default: return session.state;
          }
        }
        async onOffer(session, offer) {
          const list = h('ul', { class: 'dm-stack-sm' }, offer.items.map((it) => h('li', { text: `${it.name} (${i18n.formatBytes(it.size)})` })));
          const body = h('div', { class: 'dm-stack' }, h('p', { text: t('mobile.incoming.hint') }), list, h('p', { class: 'dm-m-code', text: session.code || '' }));
          const ok = await dialog.open({ title: t('mobile.incoming.title', { name: (session.peerInfo && session.peerInfo.name) || '' }), body, actions: [{ label: t('mobile.incoming.reject'), value: false }, { label: t('mobile.incoming.accept'), variant: 'primary', value: true, primary: true }] });
          if (ok === true) offer.accept(); else offer.reject();
        }
        onProgress(p) {
          let row = this.state.transfers.find((x) => x.id === p.id && x.direction === p.direction);
          if (!row) { row = { id: p.id, name: p.name, size: p.size, received: 0, direction: p.direction, done: false }; this.state.transfers.push(row); if (!this.transferBox || !this.transferBox.isConnected) this.render(); }
          row.received = p.received;
          this.renderTransfers();
        }
        async onItem(session, item) {
          const row = this.state.transfers.find((x) => x.id === item.id && x.direction === 'in');
          if (row) { row.done = true; row.received = item.size; }
          const kept = await keep(item.blob, item.name, (session.peerInfo && session.peerInfo.name) || '');
          this.state.bundles = await listBundles();
          await this.field.adopt(kept);
          toast.show(t('mobile.received', { name: item.name }), { kind: 'ok' });
          this.render();
        }
        async sendItems(items) {
          const session = this.state.session;
          if (!session || session.state !== 'connected') { toast.show(t('p2p.err.notconnected'), { kind: 'warn' }); return null; }
          const res = await session.send(items);
          if (res.confirmed.length) toast.show(t('mobile.send.done', { n: res.confirmed.length }), { kind: 'ok' });
          else toast.show(t('devices.rejected'), { kind: 'warn' });
          return res;
        }
        async sendFiles() {
          const picked = await files.pick({ multiple: true });
          if (!picked.length) return;
          await this.sendItems(picked.map((f) => ({ name: f.name, type: f.type, data: f, kind: /\.zip$/i.test(f.name) ? 'bundle' : 'file' })));
        }
        async sendStored() {
          const chosen = new Set();
          const switches = this.state.bundles.filter((b) => b.kind !== 'form').map((b) => { const sw = /** @type {any} */ (h('dm-switch', { label: (b.title || b.name) + ' (' + i18n.formatBytes(b.size) + ')' })); sw.addEventListener('change', () => { if (sw.checked) chosen.add(b.id); else chosen.delete(b.id); }); return sw; });
          const ok = await dialog.open({ title: t('mobile.send.choose'), body: h('div', { class: 'dm-stack-sm' }, switches), actions: [{ label: t('common.cancel'), value: false }, { label: t('devices.send'), variant: 'primary', value: true, primary: true }] });
          if (ok !== true || !chosen.size) return;
          const items = [];
          for (const b of this.state.bundles) if (chosen.has(b.id)) { const blob = await loadBlob(b.id); if (blob) items.push({ name: b.name, type: b.type, data: blob, kind: b.kind }); }
          await this.sendItems(items);
        }
        async sendQueued() {
          const queue = this.state.queue.slice();
          this.state.queue = [];
          const items = [];
          const after = [];
          for (const b of queue) {
            // Rows from the field are packed when the computer is there, and marked as sent when it has them.
            if (b.build) { const built = await b.build(); items.push(...built.items); after.push(built.done); continue; }
            const blob = await loadBlob(b.id);
            if (blob) items.push({ name: b.name, type: b.type, data: blob, kind: b.kind });
          }
          if (items.length) {
            const res = await this.sendItems(items);
            if (res) for (const done of after) await done(res);
          }
          this.render();
        }
        queueForComputer(b) { this.state.queue = [b]; toast.show(t('mobile.queue.hint'), { kind: 'info' }); this.go('start'); }

        // ---- scanning ----
        canScan() { return 'BarcodeDetector' in globalThis && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
        async scan() {
          if (!this.canScan()) { await this.pasteCode(); return; }
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
            const video = /** @type {HTMLVideoElement} */ (h('video', { class: 'dm-m-video', autoplay: '', playsinline: '', muted: '' }));
            video.srcObject = stream;
            await video.play();
            const Detector = /** @type {any} */ (globalThis).BarcodeDetector;
            const detector = new Detector({ formats: ['qr_code'] });
            this.state.scanning = { stream, video };
            this.render();
            const loop = async () => {
              if (!this.state.scanning) return;
              try {
                const codes = await detector.detect(video);
                const hit = codes.find((c) => /#o=/.test(c.rawValue || ''));
                if (hit) { const m = /#o=([A-Za-z0-9_-]+)/.exec(hit.rawValue); this.stopScan(); if (m) await this.connectTo(m[1]); return; }
              } catch (_err) { /* frame not ready */ }
              setTimeout(loop, 250);
            };
            loop();
          } catch (err) { this.fail(err); }
        }
        stopScan() { const s = this.state.scanning; if (s) { try { s.stream.getTracks().forEach((tr) => tr.stop()); } catch (_err) { /* ignore */ } this.state.scanning = null; } }
        async pasteCode() {
          const code = await dialog.prompt(t('mobile.paste.label'), { value: '' });
          if (code && String(code).trim()) await this.connectTo(String(code).trim());
        }

        // ---- bundles and viewing ----
        async openBundle(id) { const b = this.state.bundles.find((x) => x.id === id); if (!b) return; this.state.bundle = b; this.go('bundle'); }
        async openDatasetView(b, d) {
          const blob = await loadBlob(b.id);
          if (!blob) { toast.show(t('mobile.err.missing', { file: b.name }), { kind: 'error' }); return; }
          if (this.state.view) this.state.view.close();
          const view = await openDataset(blob, d.file);
          this.state.view = Object.assign({ name: d.name, data: [], shown: view.total }, view);
          this.state.page = 0; this.state.filter = '';
          this.go('dataset');
          await this.loadRows();
        }
        async loadRows() {
          const v = this.state.view;
          if (!v) return;
          const filter = this.state.filter;
          v.shown = await v.count(filter);
          const maxPage = Math.max(0, Math.ceil(v.shown / PAGE) - 1);
          if (this.state.page > maxPage) this.state.page = maxPage;
          v.data = await v.rows(this.state.page * PAGE, PAGE, filter);
          if (this.state.view === v) this.render();
        }
        async forward(b) {
          const blob = await loadBlob(b.id);
          if (!blob) return;
          const file = new File([blob], b.name, { type: b.type || 'application/octet-stream' });
          if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
            try { await navigator.share({ files: [file], title: b.title || b.name }); } catch (err) { if (!err || err.name !== 'AbortError') this.fail(err); }
          } else files.download(file, b.name);
        }
        async deleteBundle(b) {
          if (!(await dialog.confirm(t('mobile.delete.confirm', { name: b.title || b.name }), { danger: true }))) return;
          await removeBundle(b.id);
          this.state.bundles = await listBundles();
          this.state.bundle = null;
          this.go('start');
        }

        // ---- rendering ----
        header() {
          const s = this.state;
          const back = s.screen !== 'start' ? button({ label: t('mobile.back'), icon: 'chevron-left', 'icon-only': true, variant: 'ghost', onClick: () => this.back() }) : h('span', { class: 'dm-m-logo' }, icon('smartphone', 22));
          const title = s.screen === 'field' || s.screen === 'fieldrow' ? this.field.title() : s.screen === 'bundle' && s.bundle ? (s.bundle.title || s.bundle.name) : s.screen === 'dataset' && s.view ? s.view.name : s.screen === 'connect' ? t('mobile.connect.title') : s.screen === 'settings' ? t('mobile.settings') : t('mobile.title');
          const settings = s.screen === 'start' ? button({ label: t('mobile.settings'), icon: 'settings', 'icon-only': true, variant: 'ghost', onClick: () => this.go('settings') }) : null;
          return h('header', { class: 'dm-m-head' }, back, h('h1', { class: 'dm-m-title', text: title }), settings);
        }
        transfersEl() {
          this.transferBox = h('div', { class: 'dm-m-progress' });
          this.renderTransfers();
          return this.transferBox;
        }
        renderTransfers() {
          if (!this.transferBox) return;
          replace(this.transferBox, this.state.transfers.map((x) => {
            const pct = x.size ? Math.round(100 * x.received / x.size) : 0;
            return h('div', { class: 'dm-stack-xs' }, h('div', { class: 'dm-row' }, icon(x.direction === 'in' ? 'download' : 'upload', 16), h('span', { class: 'dm-grow dm-truncate', text: x.name }), h('span', { class: 'dm-help', text: x.done ? t(x.direction === 'in' ? 'devices.received' : 'devices.delivered') : pct + ' %' })), h('dm-progress', { value: String(pct), label: x.name }));
          }));
        }
        startScreen() {
          const s = this.state;
          if (s.scanning) {
            return [h('section', { class: 'dm-m-card' }, h('p', { class: 'dm-help', text: t('mobile.scan.hint') }), s.scanning.video, h('div', { class: 'dm-m-actions' }, button({ label: t('mobile.scan.cancel'), icon: 'x', onClick: () => { this.stopScan(); this.render(); } })))];
          }
          const canScan = this.canScan();
          const connectCard = h('section', { class: 'dm-m-card' },
            h('h2', { text: t('mobile.connect.title') }),
            h('p', { class: 'dm-help', text: p2p.supported() ? t('mobile.connect.hint') : t('mobile.unsupported') }),
            s.queue.length ? h('p', { class: 'dm-m-queue', text: t('mobile.queue', { name: s.queue[0].title || s.queue[0].name }) }) : null,
            p2p.supported() ? h('div', { class: 'dm-m-actions' },
              canScan ? button({ label: t('mobile.scan'), icon: 'scan-line', variant: 'primary', onClick: () => this.scan() }) : null,
              button({ label: t('mobile.paste'), icon: 'clipboard-paste', variant: canScan ? 'default' : 'primary', onClick: () => this.pasteCode() })) : null);
          const kept = s.bundles.filter((b) => b.kind !== 'form');
          const list = kept.length
            ? h('div', { class: 'dm-m-list' }, kept.map((b) => this.item(icon(b.kind === 'bundle' ? 'package' : 'file', 20), b.title || b.name, this.subtitle(b), () => this.openBundle(b.id))))
            : h('p', { class: 'dm-help', text: t('mobile.received.none') });
          const receivedCard = h('section', { class: 'dm-m-card' }, h('h2', { text: t('mobile.received.title') }), list);
          return [this.field.startCard(), connectCard, receivedCard].filter(Boolean);
        }
        connectScreen() {
          const s = this.state; const session = s.session;
          if (!session) return [h('section', { class: 'dm-m-card' }, h('p', { class: 'dm-help', text: t('mobile.status.closed') }))];
          const parts = [h('p', { class: 'dm-m-status', 'data-state': session.state, text: this.statusText(session) })];
          if (session.state !== 'connected' && !session.paired && session.answerCode) {
            parts.push(h('p', { class: 'dm-help', text: t('mobile.code.hint') }), h('p', { class: 'dm-m-identity', text: session.answerCode }));
            if (this.qrFor !== session.answerPayload) { this.qrFor = session.answerPayload; this.qrEl = null; qr.element(session.answerPayload, { size: 200, label: t('mobile.code.qr') }).then((svg) => { if (this.qrFor === session.answerPayload) { this.qrEl = svg; this.render(); } }).catch(() => {}); }
            if (this.qrEl) parts.push(h('div', { class: 'dm-m-qr' }, this.qrEl));
          }
          if (session.state === 'connected') {
            parts.push(h('div', { class: 'dm-m-verify' }, h('span', { class: 'dm-help', text: t('mobile.verify') }), h('span', { class: 'dm-m-code', text: session.code || '' }), h('span', { class: 'dm-help', text: t('mobile.verify.help') })));
            parts.push(h('p', { class: 'dm-help', text: t('mobile.waiting.offer') }));
            parts.push(h('div', { class: 'dm-m-actions' },
              button({ label: t('mobile.send.files'), icon: 'upload', onClick: () => this.sendFiles().catch((err) => this.fail(err)) }),
              s.bundles.some((b) => b.kind !== 'form') ? button({ label: t('mobile.send.bundle'), icon: 'package', onClick: () => this.sendStored().catch((err) => this.fail(err)) }) : null,
              button({ label: t('mobile.disconnect'), icon: 'x', variant: 'ghost', onClick: () => { this.closeSession(); this.go('start'); } })));
          } else if (session.state === 'failed' || session.state === 'closed' || session.state === 'disconnected') {
            parts.push(h('div', { class: 'dm-m-actions' }, button({ label: t('mobile.back.start'), icon: 'chevron-left', onClick: () => this.go('start') })));
          }
          parts.push(this.transfersEl());
          return [h('section', { class: 'dm-m-card' }, parts)];
        }
        bundleScreen() {
          const b = this.state.bundle;
          if (!b) return this.startScreen();
          const info = h('section', { class: 'dm-m-card' },
            h('p', { class: 'dm-help', text: this.subtitle(b) }),
            b.author ? h('p', { class: 'dm-help', text: t('mobile.from', { name: b.author }) }) : null,
            b.message ? h('p', { text: b.message }) : null,
            h('div', { class: 'dm-m-actions' },
              button({ label: t('mobile.forward'), icon: 'share-2', variant: 'primary', onClick: () => this.forward(b).catch((err) => this.fail(err)) }),
              p2p.supported() ? button({ label: t('mobile.send.computer'), icon: 'monitor', onClick: () => this.queueForComputer(b) }) : null,
              button({ label: t('mobile.delete'), icon: 'trash-2', variant: 'danger', onClick: () => this.deleteBundle(b).catch((err) => this.fail(err)) })));
          const ds = b.datasets.length
            ? h('div', { class: 'dm-m-list' }, b.datasets.map((d) => this.item(icon('table', 20), d.name, t('mobile.dataset.sub', { rows: i18n.formatNumber(d.rowCount || 0), cols: i18n.formatNumber(d.columnCount || 0) }), () => this.openDatasetView(b, d).catch((err) => this.fail(err)))))
            : h('p', { class: 'dm-help', text: b.kind === 'bundle' ? t('mobile.datasets.none') : t('mobile.file.plain') });
          return [info, h('section', { class: 'dm-m-card' }, h('h2', { text: t('mobile.datasets') }), ds)];
        }
        datasetScreen() {
          const v = this.state.view;
          if (!v) return this.bundleScreen();
          const filter = /** @type {any} */ (h('dm-input', { label: t('mobile.filter'), placeholder: t('mobile.filter.placeholder') }));
          filter.value = this.state.filter;
          filter.addEventListener('input', () => { clearTimeout(this.filterTimer); this.filterTimer = setTimeout(() => { this.state.filter = filter.value; this.state.page = 0; this.loadRows().catch((err) => this.fail(err)); }, 300); });
          const from = v.shown ? this.state.page * PAGE + 1 : 0;
          const to = Math.min(v.shown, (this.state.page + 1) * PAGE);
          const prev = button({ label: t('mobile.prev'), icon: 'chevron-left', 'icon-only': true, onClick: () => { this.state.page--; this.loadRows().catch((err) => this.fail(err)); } });
          const next = button({ label: t('mobile.next'), icon: 'chevron-right', 'icon-only': true, onClick: () => { this.state.page++; this.loadRows().catch((err) => this.fail(err)); } });
          prev.disabled = this.state.page === 0;
          next.disabled = to >= v.shown;
          const pager = h('div', { class: 'dm-m-pager' }, prev, h('span', { class: 'dm-help', text: t('mobile.rows.range', { from: i18n.formatNumber(from), to: i18n.formatNumber(to), total: i18n.formatNumber(v.shown) }) }), next);
          const numeric = (c) => /^(number|integer|float|real)$/.test(c.type);
          const table = h('table', { class: 'dm-m-table' },
            h('thead', null, h('tr', null, v.columns.map((c) => h('th', { text: c.label || c.name, scope: 'col' })))),
            h('tbody', null, (v.data || []).map((r) => h('tr', null, r.map((cell, i) => h('td', { class: numeric(v.columns[i]) ? 'dm-num' : '', text: cell === null || cell === undefined ? '' : (typeof cell === 'number' ? i18n.formatNumber(cell) : String(cell)) }))))));
          return [h('section', { class: 'dm-m-card' }, filter, pager, h('div', { class: 'dm-m-table-wrap' }, table))];
        }
        settingsScreen() {
          const id = this.state.identity;
          const nameIn = /** @type {any} */ (h('dm-input', { label: t('mobile.name') }));
          nameIn.value = id ? id.name : '';
          const save = button({ label: t('common.save'), icon: 'check', onClick: async () => { await p2p.setDeviceName(nameIn.value); this.state.identity = await p2p.identity(); toast.show(t('devices.copied').replace(/.*/, t('common.save')), { kind: 'ok' }); this.render(); } });
          const lang = /** @type {any} */ (h('dm-select', { label: t('mobile.language') }));
          lang.options = i18n.LANGUAGES.map((l) => ({ value: l.code, label: l.native || l.name || l.code }));
          lang.value = i18n.language();
          lang.addEventListener('change', async () => { try { await i18n.loadLanguage(lang.value); } catch (_err) { /* bundled */ } i18n.setLanguage(lang.value); location.reload(); });
          const appLink = h('a', { class: 'dm-help', href: '../', text: t('mobile.open.app') });
          return [h('section', { class: 'dm-m-card' }, h('div', { class: 'dm-row-wrap' }, nameIn, save), h('p', { class: 'dm-help', text: t('mobile.identity') }), h('p', { class: 'dm-m-identity', text: id ? id.code : '' }), lang, appLink)];
        }
        render() {
          if (this.destroyed) return;
          const s = this.state;
          const content = s.screen === 'field' ? this.field.formScreen() : s.screen === 'fieldrow' ? this.field.rowScreen() : s.screen === 'connect' ? this.connectScreen() : s.screen === 'bundle' ? this.bundleScreen() : s.screen === 'dataset' ? this.datasetScreen() : s.screen === 'settings' ? this.settingsScreen() : this.startScreen();
          replace(this.root, h('div', { class: 'dm-m' }, this.header(), h('main', { class: 'dm-m-main' }, content)));
        }
        destroy() { this.destroyed = true; this.field.destroy(); this.stopScan(); this.closeSession(); if (this.state.view) this.state.view.close(); }
      }

      /** @param {HTMLElement} root @param {{hash?: string, certificate?: RTCCertificate}} [options] */
      async function start(root, options = {}) {
        fonts.loadFonts();
        const app = new Mobile(root, options);
        await app.init();
        D.mobile = app;
        return app;
      }

      return { start, Mobile, describe, keep, listBundles, loadBlob, removeBundle, openDataset, drainInbox, INBOX, PAGE };
    });
})();
