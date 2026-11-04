// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The Enheter tab in Dela: direct transfer to and from phones and other computers over WebRTC (platform/p2p).
 * The computer shows a QR code (the mobile page's address with the offer after the hash) or a text code; a paired
 * device connects at once, a new device answers with its fingerprint code. Once connected both sides show the same
 * six-digit verification code, items can be sent (bundles, files) and received (bundles open in Ta emot, other
 * files are imported), and the device can be paired so that the next time one scan is enough.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/share/devices', ['ui/base', 'platform/p2p', 'ui/qr', 'ui/share/bundle', 'ui/share/review'], (base, p2p, qr, share, review) => {
    const { h, t, i18n, replace } = base;

    const formatSize = (n) => i18n.formatBytes(n);
    async function copyText(ctx, text) {
      try { await navigator.clipboard.writeText(text); ctx.ui.toast.show(t('devices.copied'), { kind: 'ok' }); }
      catch (_err) { ctx.ui.toast.show(t('devices.copy.failed'), { kind: 'warn' }); }
    }

    /**
     * @param {any} ctx the mode context
     * @param {{onChanged?: () => void}} [options]
     */
    async function create(ctx, options = {}) {
      const { ui, services, shell, store } = ctx;
      const el = h('div', { class: 'dm-stack' });
      const state = {
        target: 'new', session: null, qrEl: null, qrFor: null, status: '', peers: await p2p.peers(), identity: null,
        transfers: /** @type {Array<{id: string, name: string, size: number, received: number, direction: string, done?: boolean}>} */ ([]),
        destroyed: false, answerShown: false,
      };
      try { state.identity = await p2p.identity(); } catch (err) { D.log('devices', 'identity', err); }
      const fail = (err) => { shell.log(String((err && err.message) || err), 'error'); ui.toast.show(String((err && err.message) || err), { kind: 'error' }); };
      const refreshPeers = async () => { state.peers = await p2p.peers(); render(); if (options.onChanged) options.onChanged(); };

      function closeSession() {
        if (state.session) { try { state.session.close(); } catch (_err) { /* ignore */ } }
        state.session = null; state.qrEl = null; state.qrFor = null; state.answerShown = false;
      }
      function attach(session) {
        closeSession();
        state.session = session;
        state.transfers = [];
        session.on('state', () => { if (!state.destroyed) render(); });
        session.on('answer', () => { if (!state.destroyed) render(); });
        session.on('hello', () => { if (!state.destroyed) render(); });
        session.on('error', (err) => { if (!state.destroyed) { shell.log(t('devices.status.failed', { error: (err && err.message) || String(err) }), 'error'); render(); } });
        session.on('progress', (p) => {
          let row = state.transfers.find((x) => x.id === p.id && x.direction === p.direction);
          if (!row) { row = { id: p.id, name: p.name, size: p.size, received: 0, direction: p.direction }; state.transfers.push(row); }
          row.received = p.received;
          renderTransfers();
        });
        session.on('offer', (o) => onIncomingOffer(session, o).catch(fail));
        session.on('item', (item) => onItem(item).catch(fail));
        session.on('delivered', (msg) => { const row = state.transfers.find((x) => x.id === msg.id && x.direction === 'out'); if (row) { row.done = !!msg.ok; renderTransfers(); } });
        session.on('paired', () => { refreshPeers().catch(fail); });
      }

      async function onIncomingOffer(session, offer) {
        const list = h('ul', { class: 'dm-stack-sm' }, offer.items.map((it) => h('li', { text: t('devices.incoming.size', { name: it.name, size: formatSize(it.size) }) })));
        const body = h('div', { class: 'dm-stack' },
          h('p', { text: t('devices.incoming.hint', { name: (session.peerInfo && session.peerInfo.name) || t('p2p.device.phone') }) }),
          list,
          h('p', { class: 'dm-help', text: t('devices.verify.help') }),
          h('p', { class: 'dm-devices-code', text: session.code || '' }));
        const ok = await ui.dialog.open({ help: 'dela#enheter', title: t('devices.incoming.title', { name: (session.peerInfo && session.peerInfo.name) || '' }), body, actions: [{ label: t('devices.incoming.reject'), value: false }, { label: t('devices.incoming.accept'), variant: 'primary', value: true, primary: true }] });
        if (ok === true) offer.accept(); else offer.reject();
      }
      async function onItem(item) {
        const row = state.transfers.find((x) => x.id === item.id && x.direction === 'in');
        if (row) { row.done = true; row.received = item.size; renderTransfers(); }
        const file = new File([item.blob], item.name, { type: item.type || 'application/octet-stream' });
        if (item.kind === 'bundle' || /\.zip$/i.test(item.name)) { await share.receiveFile(ctx, file); return; }
        const meta = await services.importer.run(file, {}, null, services.importer.baseName ? services.importer.baseName(item.name) : item.name.replace(/\.[^.]+$/, ''));
        shell.log(t('devices.item.imported', { name: meta.name || item.name }), 'ok');
        ui.toast.show(t('devices.item.imported', { name: meta.name || item.name }), { kind: 'ok' });
      }

      // ---- actions ----
      async function startOffer() {
        const peer = state.target !== 'new' && state.target !== 'code' ? state.peers.find((p) => p.id === state.target) : null;
        attach(p2p.offer({ peer }));
        render();
      }
      async function connectWithAnswer(code) {
        if (!state.session) return;
        try { await state.session.acceptAnswer(code.trim()); } catch (err) { fail(err); }
        render();
      }
      async function answerCode(code) {
        if (!code.trim()) return;
        attach(p2p.answer(code.trim()));
        state.answerShown = true;
        render();
      }
      async function pairNow() {
        try { await state.session.pairPeer(); ui.toast.show(t('devices.paired'), { kind: 'ok' }); await refreshPeers(); } catch (err) { fail(err); }
      }
      async function sendNow(what, btn) {
        const session = state.session;
        if (!session || session.state !== 'connected') { ui.toast.show(t('p2p.err.notconnected'), { kind: 'warn' }); return; }
        btn.loading = true;
        try {
          const items = [];
          if (what === 'pending') {
            const p = store.get().devicesPending;
            if (p) items.push({ name: p.name, type: 'application/zip', data: p.blob, kind: p.kind });
          } else if (what === 'files') {
            const picked = await services.files.pick({ multiple: true });
            for (const f of picked) items.push({ name: f.name, type: f.type, data: f, kind: 'file' });
          } else {
            const s = store.get();
            const ids = what === 'all' ? s.datasets.map((d) => d.id) : (s.selectedIds && s.selectedIds.length ? s.selectedIds.slice() : (s.selectedId ? [s.selectedId] : []));
            if (!ids.length) { ui.toast.show(t('dela.share.nodataset'), { kind: 'warn' }); btn.loading = false; return; }
            const reviewed = await review.review(ctx, ids);
            if (!reviewed) { btn.loading = false; return; }
            const name = t('bundle.default.name');
            const res = await services.workspace.bundle({ name, datasetIds: ids, include: { charts: true, dashboards: true, documents: true, notebooks: true, scripts: true }, author: await D.require('data/comments').author(), message: '', transform: reviewed.transform });
            const note = review.summary(reviewed.transform);
            if (note) shell.log(note, 'info');
            items.push({ name: services.files.safeName(name, 'dataspatium.zip'), type: 'application/zip', data: res.blob, kind: 'bundle', meta: { datasets: ids.length } });
          }
          if (!items.length) { btn.loading = false; return; }
          const res = await session.send(items);
          if (what === 'pending' && res.confirmed.length) store.set({ devicesPending: null });
          if (res.confirmed.length) { shell.log(t('devices.sent', { n: res.confirmed.length }), 'ok'); ui.toast.show(t('devices.sent', { n: res.confirmed.length }), { kind: 'ok' }); }
          else ui.toast.show(t('devices.rejected'), { kind: 'warn' });
        } catch (err) { fail(err); }
        btn.loading = false;
      }

      // ---- rendering ----
      const transfersEl = h('div', { class: 'dm-stack-sm' });
      function renderTransfers() {
        replace(transfersEl, state.transfers.map((x) => {
          const pct = x.size ? Math.round(100 * x.received / x.size) : 0;
          const bar = /** @type {any} */ (h('dm-progress', { value: String(pct), label: x.name }));
          return h('div', { class: 'dm-stack-xs' },
            h('div', { class: 'dm-row' }, ui.icon(x.direction === 'in' ? 'download' : 'upload', 16), h('span', { class: 'dm-grow dm-truncate', text: x.name }), h('span', { class: 'dm-muted dm-small', text: x.done ? t(x.direction === 'in' ? 'devices.received' : 'devices.delivered') : pct + ' %' })),
            bar);
        }));
      }
      function statusText(session) {
        if (!session) return '';
        switch (session.state) {
          case 'new': case 'gathering': return t('devices.status.preparing');
          case 'waiting': return t('devices.status.waiting');
          case 'connecting': return t('devices.status.connecting');
          case 'connected': return t('devices.status.connected', { name: (session.peerInfo && session.peerInfo.name) || '…' });
          case 'disconnected': case 'closed': return t('devices.status.closed');
          case 'failed': return t('devices.status.failed', { error: session.error || '' });
          default: return session.state;
        }
      }
      async function qrFor(session) {
        if (!session.offerPayload) return null;
        if (state.qrFor === session.offerPayload && state.qrEl) return state.qrEl;
        const url = await session.offerUrl();
        state.qrEl = await qr.element(url, { size: 240, label: t('devices.qr.alt') });
        state.qrFor = session.offerPayload;
        return state.qrEl;
      }

      function render() {
        if (state.destroyed) return;
        const session = state.session;
        const connected = !!session && session.state === 'connected';
        // This device
        const nameIn = /** @type {any} */ (h('dm-input', { label: t('devices.name'), value: (state.identity && state.identity.name) || '' }));
        const saveName = ui.button({ label: t('common.save'), icon: 'check', size: 'sm', onClick: async () => { await p2p.setDeviceName(nameIn.value); state.identity = await p2p.identity(); render(); } });
        const idCode = (state.identity && state.identity.code) || '';
        // The address of the mobile page as a QR code, for opening Dataspatium Mobil on a phone the first time.
        const mobileBox = h('div', { class: 'dm-stack-sm' });
        const mobileBtn = ui.button({ label: t('devices.mobile.qr'), icon: 'smartphone', size: 'sm', onClick: async () => {
          if (mobileBox.childElementCount) { replace(mobileBox); return; }
          try {
            const url = await p2p.mobileUrl();
            replace(mobileBox, h('div', { class: 'dm-devices-qr' }, await qr.element(url, { size: 200, label: t('devices.mobile.qr') })), h('p', { class: 'dm-help', text: t('devices.mobile.hint', { url }) }));
          } catch (err) { fail(err); }
        } });
        const thisCard = h('div', { class: 'dm-card dm-stack' },
          h('h3', { text: t('devices.this.title') }),
          h('div', { class: 'dm-row-wrap' }, nameIn, saveName),
          h('div', { class: 'dm-row-wrap' }, h('span', { class: 'dm-muted dm-small', text: t('devices.identity') }), h('code', { class: 'dm-devices-identity', text: idCode }), ui.button({ label: t('devices.copy'), icon: 'copy', size: 'sm', onClick: () => copyText(ctx, idCode) })),
          h('div', null, mobileBtn), mobileBox);
        // Connect
        const target = /** @type {any} */ (h('dm-select', { label: t('devices.target') }));
        target.options = [{ value: 'new', label: t('devices.target.new') }].concat(state.peers.map((p) => ({ value: p.id, label: p.name || p.id.slice(0, 12) })), [{ value: 'code', label: t('devices.target.code') }]);
        target.value = state.target;
        target.addEventListener('change', () => { state.target = target.value; closeSession(); render(); });
        const connectParts = [h('h3', { text: t('devices.connect.title') }), h('p', { class: 'dm-help', text: t('devices.connect.hint') }), target];
        if (state.target === 'code') {
          const paste = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '3', label: t('devices.paste.label'), placeholder: 'eyJ…' }));
          const go = ui.button({ label: t('devices.connect'), icon: 'arrow-right-left', variant: session ? 'default' : 'primary', onClick: () => answerCode(paste.value) });
          connectParts.push(h('div', { class: 'dm-row-wrap' }, paste, go));
          if (session && session.answerPayload) {
            connectParts.push(h('p', { class: 'dm-help', text: t('devices.mycode') }), h('div', { class: 'dm-row-wrap' }, h('code', { class: 'dm-devices-identity dm-truncate', text: session.answerPayload }), ui.button({ label: t('devices.copy'), icon: 'copy', size: 'sm', onClick: () => copyText(ctx, session.answerPayload) })));
          }
        } else {
          if (!session || session.state === 'closed' || session.state === 'failed' || session.state === 'disconnected') {
            connectParts.push(h('div', null, ui.button({ label: t('devices.showQr'), icon: 'qr-code', variant: 'primary', onClick: startOffer })));
          }
          if (session && session.offerPayload && !connected) {
            const qrBox = h('div', { class: 'dm-devices-qr' });
            qrFor(session).then((svg) => { if (svg && !state.destroyed) replace(qrBox, svg); }).catch(fail);
            connectParts.push(qrBox, h('p', { class: 'dm-help', text: t('devices.qr.help') }),
              h('div', { class: 'dm-row-wrap' }, h('span', { class: 'dm-muted dm-small', text: t('devices.code.label') }), ui.button({ label: t('devices.copy'), icon: 'copy', size: 'sm', onClick: () => copyText(ctx, session.offerPayload) })));
            if (state.target === 'new' && session.state === 'waiting') {
              const answerIn = /** @type {any} */ (h('dm-input', { label: t('devices.answer.label'), help: t('devices.answer.help'), placeholder: 'ABCD-EFGH-…' }));
              const go = ui.button({ label: t('devices.connect'), icon: 'arrow-right-left', onClick: () => connectWithAnswer(answerIn.value) });
              connectParts.push(h('div', { class: 'dm-row-wrap' }, answerIn, go));
            }
          }
        }
        if (session) {
          connectParts.push(h('p', { class: 'dm-devices-status', 'data-state': session.state, text: statusText(session) }));
          if (connected) {
            connectParts.push(h('div', { class: 'dm-stack-xs' }, h('span', { class: 'dm-muted dm-small', text: t('devices.verify') }), h('span', { class: 'dm-devices-code', text: session.code || '' }), h('span', { class: 'dm-help', text: t('devices.verify.help') })));
            const row = [ui.button({ label: t('devices.disconnect'), icon: 'x', onClick: () => { closeSession(); render(); } })];
            if (!session.paired) row.unshift(ui.button({ label: t('devices.pair'), icon: 'link', variant: 'primary', onClick: pairNow }));
            connectParts.push(h('div', { class: 'dm-row-wrap' }, row));
          } else if (session.state !== 'closed' && session.state !== 'failed') {
            connectParts.push(h('div', null, ui.button({ label: t('common.cancel'), icon: 'x', size: 'sm', onClick: () => { closeSession(); render(); } })));
          }
        }
        const connectCard = h('div', { class: 'dm-card dm-stack' }, connectParts);
        // Send
        const what = /** @type {any} */ (h('dm-select', { label: t('devices.send.what') }));
        const s = store.get();
        const nSelected = s.selectedIds && s.selectedIds.length ? s.selectedIds.length : (s.selectedId ? 1 : 0);
        what.options = [{ value: 'selected', label: t('devices.send.what.selected', { n: nSelected }) }, { value: 'all', label: t('devices.send.what.all') }, { value: 'files', label: t('devices.send.what.files') }];
        what.value = 'selected';
        if (s.devicesPending) {
          what.options = [{ value: 'pending', label: t('devices.send.pending', { name: s.devicesPending.label }) }].concat(what.options);
          what.value = 'pending';
        }
        const sendBtn = ui.button({ label: t('devices.send'), icon: 'upload', variant: connected ? 'primary' : 'default', onClick: () => sendNow(what.value, sendBtn) });
        if (!connected) sendBtn.disabled = true;
        renderTransfers();
        const sendCard = h('div', { class: 'dm-card dm-stack' }, h('h3', { text: t('devices.send.title') }), h('p', { class: 'dm-help', text: t('devices.send.hint') }), h('div', { class: 'dm-row-wrap' }, what, sendBtn), transfersEl);
        // Paired devices
        const peerRows = state.peers.map((p) => h('div', { class: 'dm-row' }, ui.icon('smartphone', 16), h('span', { class: 'dm-grow dm-truncate', text: p.name || p.id.slice(0, 12) }), h('span', { class: 'dm-muted dm-small', text: t('devices.peers.since', { date: i18n.formatDateTime ? i18n.formatDateTime(p.pairedAt) : p.pairedAt }) }), ui.button({ label: t('devices.peers.forget'), icon: 'trash-2', size: 'sm', variant: 'ghost', onClick: async () => { await p2p.forget(p.id); if (state.target === p.id) state.target = 'new'; await refreshPeers(); } })));
        const peersCard = h('div', { class: 'dm-card dm-stack' }, h('h3', { text: t('devices.peers.title') }), peerRows.length ? h('div', { class: 'dm-stack-sm' }, peerRows) : h('p', { class: 'dm-help', text: t('devices.peers.none') }));
        replace(el, p2p.supported() ? [thisCard, connectCard, sendCard, peersCard] : [h('div', { class: 'dm-card' }, h('p', { class: 'dm-help', text: t('devices.unsupported') }))]);
      }

      render();
      return {
        el,
        get session() { return state.session; },
        get state() { return state; },
        startOffer, answerCode, connectWithAnswer, pairNow, render,
        destroy() { state.destroyed = true; closeSession(); },
      };
    }

    return { create, formatSize };
  });
})();
