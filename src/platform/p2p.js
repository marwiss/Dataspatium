// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Direct transfer between devices with WebRTC data channels and no signalling server.
 *
 * The offering device (usually the computer) shows a compact payload: its ICE credentials, DTLS fingerprint,
 * host candidates and a session id, carried by a QR code or a pasted code. The answering device (a phone that
 * opened the mobile page from the QR, or another computer) rebuilds a full offer from a template, answers with
 * credentials *derived* from a shared secret and the session id, and connects. The offerer never needs the answer
 * back: it sets a synthetic answer with the derived credentials and the peer's certificate fingerprint and finds
 * the peer's address from its incoming ICE checks (peer-reflexive). Only the fingerprint of a device that has not
 * been paired yet has to travel back once, as a 52-character code or a QR code; after pairing one scan is enough.
 *
 * Over the open channel the devices exchange a greeting, a six-digit verification code is derived from both
 * fingerprints and the session, and items (bundles, files) are sent in 16 KiB blocks with SHA-256 per item,
 * approval by the receiver and resumption from the bytes already received.
 *
 * Nothing here touches the DOM; `ui/share/devices-panel` (computer) and `mobile/app` (phone) build the screens.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('platform/p2p', ['platform/storage/idb'], (idb) => {
    const VERSION = 1;
    const HELLO_RETRY_MS = 1000;
    const HELLO_TRIES = 15;
    const CHANNEL = 'dm';
    const CHUNK = 16384;
    const HIGH_WATER = 1 << 20;
    const LOW_WATER = 256 * 1024;
    const DAY = 86400000;
    const ICE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const SETTING_CERT = 'p2p.certificate';
    const SETTING_NAME = 'p2p.deviceName';
    const SETTING_PEERS = 'p2p.peers';
    const SETTING_MOBILE_URL = 'p2p.mobileUrl';
    /** The hosted mobile page; an intranet copy can be set under the setting above. */
    const MOBILE_URL = 'https://marwiss.github.io/Dataspatium/m/';

    // ---- small helpers ----
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    function randomChars(n, alphabet = ICE_CHARS) {
      const bytes = crypto.getRandomValues(new Uint8Array(n));
      let out = '';
      for (let i = 0; i < n; i++) out += alphabet[bytes[i] % alphabet.length];
      return out;
    }
    function toBase64Url(bytes) {
      let s = '';
      for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    function fromBase64Url(text) {
      const b64 = String(text).replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - String(text).length % 4) % 4);
      const s = atob(b64);
      const out = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
      return out;
    }
    function hexToBytes(hex) {
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
      return out;
    }
    function bytesToHex(bytes) { return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''); }
    /** RFC 4648 base32 without padding (32 bytes become 52 characters), grouped for typing. */
    function toBase32(bytes) {
      let bits = 0; let value = 0; let out = '';
      for (let i = 0; i < bytes.length; i++) {
        value = (value << 8) | bytes[i]; bits += 8;
        while (bits >= 5) { out += BASE32[(value >>> (bits - 5)) & 31]; bits -= 5; }
      }
      if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
      return out;
    }
    function fromBase32(text) {
      const clean = String(text).toUpperCase().replace(/[^A-Z2-7]/g, '');
      let bits = 0; let value = 0; const out = [];
      for (const ch of clean) {
        value = (value << 5) | BASE32.indexOf(ch); bits += 5;
        if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
      }
      return new Uint8Array(out);
    }
    /** Groups of four for reading aloud or typing: ABCD-EFGH-… */
    function groupCode(code) { return String(code).replace(/(.{4})(?=.)/g, '$1-'); }
    async function sha256(data) { return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', data))); }
    async function hmac(keyBytes, text) {
      const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
    }
    /** ICE credentials for a session, the same on both sides of a shared secret. */
    async function deriveCredentials(secretBytes, sessionId) {
      const u = await hmac(secretBytes, 'ufrag:' + sessionId);
      const p = await hmac(secretBytes, 'pwd:' + sessionId);
      const chars = (bytes, n) => Array.from(bytes.slice(0, n), (b) => ICE_CHARS[b % ICE_CHARS.length]).join('');
      return { ufrag: chars(u, 8), pwd: chars(p, 24) };
    }
    /** Six digits both devices can compare, from both fingerprints and the session. */
    async function verificationCode(fpA, fpB, sessionId) {
      const [x, y] = [fpA, fpB].sort();
      const digest = await crypto.subtle.digest('SHA-256', enc.encode(x + '|' + y + '|' + sessionId));
      const view = new DataView(digest);
      return String(view.getUint32(0) % 1000000).padStart(6, '0');
    }

    class Emitter {
      constructor() { /** @type {Map<string, Set<Function>>} */ this.listeners = new Map(); }
      on(event, fn) {
        if (!this.listeners.has(event)) this.listeners.set(event, new Set());
        this.listeners.get(event).add(fn);
        return () => { const set = this.listeners.get(event); if (set) set.delete(fn); };
      }
      emit(event, payload) { for (const fn of Array.from(this.listeners.get(event) || [])) { try { fn(payload); } catch (err) { console.error(err); } } }
    }

    // ---- identity and pairing ----
    /** @type {Promise<RTCCertificate>|null} */
    let certPromise = null;
    function certificate() {
      if (!certPromise) {
        certPromise = (async () => {
          let cert = null;
          try { cert = await idb.getSetting(SETTING_CERT, null); } catch (_err) { cert = null; }
          const usable = cert && typeof cert === 'object' && typeof cert.expires === 'number' && cert.expires - Date.now() > 7 * DAY;
          if (!usable) {
            try { cert = await RTCPeerConnection.generateCertificate(/** @type {any} */ ({ name: 'ECDSA', namedCurve: 'P-256', expires: 365 * DAY })); }
            catch (_err) { cert = await RTCPeerConnection.generateCertificate({ name: 'ECDSA', namedCurve: 'P-256' }); }
            try { await idb.setSetting(SETTING_CERT, cert); } catch (err) { D.log('p2p', 'certificate not stored', err); }
          }
          return cert;
        })();
        certPromise.catch(() => { certPromise = null; });
      }
      return certPromise;
    }
    /** SHA-256 fingerprint of a certificate as lower-case hex (64 characters). */
    async function fingerprintOf(cert) {
      const direct = typeof cert.getFingerprints === 'function' ? cert.getFingerprints().find((f) => String(f.algorithm).toLowerCase() === 'sha-256') : null;
      if (direct && direct.value) return direct.value.replace(/:/g, '').toLowerCase();
      const pc = new RTCPeerConnection({ certificates: [cert] });
      try {
        pc.createDataChannel('fp');
        const offer = await pc.createOffer();
        const m = /a=fingerprint:sha-256 ([0-9A-Fa-f:]+)/.exec(offer.sdp || '');
        if (!m) throw new Error('no fingerprint in SDP');
        return m[1].replace(/:/g, '').toLowerCase();
      } finally { pc.close(); }
    }
    async function deviceName() {
      const saved = await idb.getSetting(SETTING_NAME, null);
      if (saved) return saved;
      const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
      return D.t(mobile ? 'p2p.device.phone' : 'p2p.device.computer');
    }
    async function setDeviceName(name) { await idb.setSetting(SETTING_NAME, String(name || '').trim().slice(0, 40)); }
    /** This device: fingerprint (hex), the 52-character code of it, and its name. */
    async function identity() {
      const cert = await certificate();
      const fingerprint = await fingerprintOf(cert);
      return { fingerprint, code: groupCode(toBase32(hexToBytes(fingerprint))), name: await deviceName(), expires: cert.expires };
    }
    /** @returns {Promise<Array<{id: string, name: string, secret: string, pairedAt: string, lastSeen: string}>>} */
    async function peers() { return (await idb.getSetting(SETTING_PEERS, [])) || []; }
    async function peerById(id) { return (await peers()).find((p) => p.id === id) || null; }
    async function pair(peer) {
      const list = (await peers()).filter((p) => p.id !== peer.id);
      list.push(Object.assign({ pairedAt: new Date().toISOString(), lastSeen: new Date().toISOString() }, peer));
      await idb.setSetting(SETTING_PEERS, list);
    }
    async function touchPeer(id, patch) {
      const list = await peers();
      const p = list.find((x) => x.id === id);
      if (!p) return;
      Object.assign(p, patch || {}, { lastSeen: new Date().toISOString() });
      await idb.setSetting(SETTING_PEERS, list);
    }
    async function forget(id) { await idb.setSetting(SETTING_PEERS, (await peers()).filter((p) => p.id !== id)); }
    async function mobileUrl() {
      const custom = await idb.getSetting(SETTING_MOBILE_URL, null);
      if (custom) return custom;
      if (/^https?:$/.test(location.protocol)) return new URL((globalThis.DATASPATIUM_BASE || '') + 'm/', location.href).href;
      return MOBILE_URL;
    }

    // ---- payloads and SDP ----
    function encodePayload(obj) { return toBase64Url(enc.encode(JSON.stringify(obj))); }
    /** Parses an offer or answer code: base64url JSON, a URL with #o=/#a=, or a bare 52-character fingerprint. */
    function decodePayload(text) {
      let s = String(text || '').trim();
      const hash = /#(?:o|a)=([A-Za-z0-9_-]+)/.exec(s);
      if (hash) s = hash[1];
      if (/^[A-Za-z2-7 -]{52,70}$/i.test(s) && fromBase32(s).length === 32) return { v: VERSION, t: 'a', f: toBase64Url(fromBase32(s)) };
      let obj;
      try { obj = JSON.parse(dec.decode(fromBase64Url(s))); } catch (_err) { throw new Error(D.t('p2p.err.code')); }
      if (!obj || obj.v !== VERSION || (obj.t !== 'o' && obj.t !== 'a')) throw new Error(D.t('p2p.err.code'));
      return obj;
    }
    function fingerprintColons(hex) { return hex.toUpperCase().replace(/(..)(?=.)/g, '$1:'); }
    /** A complete data-channel-only SDP from the few values a payload carries. */
    function buildSdp({ ufrag, pwd, fingerprint, candidates, setup }) {
      const lines = ['v=0', 'o=- 0 0 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE 0', 'a=msid-semantic: WMS',
        'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0',
        'a=ice-ufrag:' + ufrag, 'a=ice-pwd:' + pwd, 'a=ice-options:trickle',
        'a=fingerprint:sha-256 ' + fingerprintColons(fingerprint), 'a=setup:' + setup, 'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144'];
      (candidates || []).forEach((c, i) => { lines.push(`a=candidate:${i + 1} 1 udp ${2113937151 - i} ${c[0]} ${c[1]} typ host generation 0`); });
      if (candidates && candidates.length) lines.push('a=end-of-candidates');
      return lines.join('\r\n') + '\r\n';
    }
    function munge(sdp, ufrag, pwd) {
      return sdp.replace(/a=ice-ufrag:.*\r\n/g, 'a=ice-ufrag:' + ufrag + '\r\n').replace(/a=ice-pwd:.*\r\n/g, 'a=ice-pwd:' + pwd + '\r\n');
    }
    /** Host UDP candidates of a local description as [address, port] pairs (mDNS names or addresses). */
    function hostCandidates(sdp) {
      const out = [];
      // Chrome writes "udp", Firefox "UDP"; the transport token is case-insensitive in SDP.
      for (const m of String(sdp || '').matchAll(/a=candidate:\S+ 1 udp \d+ (\S+) (\d+) typ host/gi)) {
        if (!out.some((c) => c[0] === m[1] && c[1] === Number(m[2]))) out.push([m[1], Number(m[2])]);
      }
      return out.slice(0, 6);
    }
    function gathered(pc, timeoutMs = 3000) {
      return new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') { resolve(); return; }
        const done = () => { pc.removeEventListener('icegatheringstatechange', check); resolve(); };
        const check = () => { if (pc.iceGatheringState === 'complete') done(); };
        pc.addEventListener('icegatheringstatechange', check);
        setTimeout(done, timeoutMs);
      });
    }

    // ---- the session ----
    /** Items received only partly (by SHA-256), kept so that a new session can resume. */
    const partials = new Map();

    class Session extends Emitter {
      /** @param {{role: 'offer'|'answer', config?: RTCConfiguration, certificate?: RTCCertificate}} options */
      constructor(options) {
        super();
        this.role = options.role;
        this.config = options.config || {};
        /** A certificate other than the device's own (tests run both ends in one page). */
        this.certificate = options.certificate || null;
        this.state = 'new';
        this.sessionId = null;
        this.local = null;
        this.remote = null;
        /** @type {RTCPeerConnection|null} */ this.pc = null;
        /** @type {RTCDataChannel|null} */ this.dc = null;
        this.fingerprint = null;
        this.name = null;
        this.peer = null;
        this.peerInfo = null;
        this.code = null;
        this.secret = null;
        this.paired = false;
        this.offerPayload = null;
        this.answerPayload = null;
        this.bootstrap = null;
        this.error = null;
        this.sending = null;
        this.receiving = null;
        this.pendingOffer = null;
        this.waiters = new Map();
      }
      setState(state) { if (this.state === state) return; this.state = state; this.emit('state', state); }
      fail(err) { this.error = (err && err.message) || String(err); this.setState('failed'); this.rejectWaiters(err); this.emit('error', err); }
      /** Nobody waits for a reply from a channel that is gone (send() would otherwise hang on 'accept' or 'done'). */
      rejectWaiters(err) {
        const error = err instanceof Error ? err : new Error(String(err || D.t('p2p.err.connection')));
        for (const list of this.waiters.values()) for (const w of list) { clearTimeout(w.timer); w.reject(error); }
        this.waiters.clear();
      }

      async prepare() {
        const cert = this.certificate || await certificate();
        this.fingerprint = await fingerprintOf(cert);
        this.name = await deviceName();
        this.pc = new RTCPeerConnection(Object.assign({ certificates: [cert] }, this.config));
        this.pc.addEventListener('connectionstatechange', () => {
          const s = this.pc && this.pc.connectionState;
          if (s === 'failed') this.fail(new Error(D.t('p2p.err.connection')));
          else if (s === 'disconnected' || s === 'closed') { if (this.state !== 'closed' && this.state !== 'failed') this.setState(s === 'closed' ? 'closed' : 'disconnected'); }
        });
      }

      /**
       * Offerer: create the offer and the payload to show. With a paired peer the answer is synthesised at once
       * (one scan); otherwise the peer's fingerprint arrives through acceptAnswer().
       * @param {{peer?: any}} [options]
       */
      async startOffer(options = {}) {
        try {
          await this.prepare();
          this.peer = options.peer || null;
          this.sessionId = randomChars(8);
          this.local = { ufrag: randomChars(8), pwd: randomChars(24) };
          this.dc = this.pc.createDataChannel(CHANNEL, { ordered: true });
          this.wire(this.dc);
          this.setState('gathering');
          const offer = await this.pc.createOffer();
          await this.pc.setLocalDescription({ type: 'offer', sdp: munge(offer.sdp, this.local.ufrag, this.local.pwd) });
          await gathered(this.pc);
          const candidates = hostCandidates(this.pc.localDescription.sdp);
          const payload = { v: VERSION, t: 'o', s: this.sessionId, u: this.local.ufrag, p: this.local.pwd, f: toBase64Url(hexToBytes(this.fingerprint)), c: candidates, n: this.name };
          if (!this.peer) { this.bootstrap = crypto.getRandomValues(new Uint8Array(16)); payload.k = toBase64Url(this.bootstrap); }
          this.offerPayload = encodePayload(payload);
          this.setState('waiting');
          if (this.peer) await this.acceptAnswer(null);
          return this.offerPayload;
        } catch (err) { this.fail(err); throw err; }
      }
      /** The page the phone opens from the QR code, with the payload after the hash. */
      async offerUrl() { return (await mobileUrl()) + '#o=' + this.offerPayload; }

      /**
       * Offerer: set the synthetic answer. `payload` is the peer's answer code (new device) or null for a paired peer,
       * whose fingerprint and secret are known.
       */
      async acceptAnswer(payload) {
        try {
          let fp; let secretBytes;
          if (this.peer) { fp = this.peer.id; secretBytes = fromBase64Url(this.peer.secret); this.paired = true; }
          else {
            const obj = typeof payload === 'string' ? decodePayload(payload) : payload;
            if (!obj || obj.t !== 'a' || !obj.f) throw new Error(D.t('p2p.err.code'));
            fp = bytesToHex(fromBase64Url(obj.f));
            secretBytes = this.bootstrap;
          }
          const creds = await deriveCredentials(secretBytes, this.sessionId);
          this.remote = { ufrag: creds.ufrag, pwd: creds.pwd, fingerprint: fp };
          this.code = await verificationCode(this.fingerprint, fp, this.sessionId);
          this.setState('connecting');
          await this.pc.setRemoteDescription({ type: 'answer', sdp: buildSdp({ ufrag: creds.ufrag, pwd: creds.pwd, fingerprint: fp, candidates: [], setup: 'active' }) });
        } catch (err) { this.fail(err); throw err; }
      }

      /**
       * Answerer: connect to an offer. The credentials come from the pairing secret when the offerer is a known
       * device, otherwise from the bootstrap secret in the offer; the fingerprint is all the offerer still needs
       * from a new device (answerPayload, also as a 52-character code).
       */
      async answer(offerPayload) {
        try {
          const obj = typeof offerPayload === 'string' ? decodePayload(offerPayload) : offerPayload;
          if (!obj || obj.t !== 'o') throw new Error(D.t('p2p.err.code'));
          await this.prepare();
          this.sessionId = obj.s;
          const offererFp = bytesToHex(fromBase64Url(obj.f));
          this.peer = await peerById(offererFp);
          const secretBytes = this.peer ? fromBase64Url(this.peer.secret) : (obj.k ? fromBase64Url(obj.k) : null);
          if (!secretBytes) throw new Error(D.t('p2p.err.unpaired'));
          this.paired = !!this.peer;
          this.local = await deriveCredentials(secretBytes, this.sessionId);
          this.remote = { ufrag: obj.u, pwd: obj.p, fingerprint: offererFp, name: obj.n };
          this.code = await verificationCode(this.fingerprint, offererFp, this.sessionId);
          this.pc.addEventListener('datachannel', (e) => { this.dc = e.channel; this.wire(this.dc); });
          this.setState('connecting');
          await this.pc.setRemoteDescription({ type: 'offer', sdp: buildSdp({ ufrag: obj.u, pwd: obj.p, fingerprint: offererFp, candidates: obj.c || [], setup: 'actpass' }) });
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription({ type: 'answer', sdp: munge(answer.sdp, this.local.ufrag, this.local.pwd) });
          this.answerPayload = encodePayload({ v: VERSION, t: 'a', s: this.sessionId, f: toBase64Url(hexToBytes(this.fingerprint)), n: this.name });
          this.answerCode = groupCode(toBase32(hexToBytes(this.fingerprint)));
          // The screens show the code for a new device as soon as it exists (no state change carries it).
          this.emit('answer', { payload: this.answerPayload, code: this.answerCode });
          return this.answerPayload;
        } catch (err) { this.fail(err); throw err; }
      }

      wire(dc) {
        dc.binaryType = 'arraybuffer';
        dc.bufferedAmountLowThreshold = LOW_WATER;
        dc.addEventListener('open', () => {
          this.setState('connected');
          if (this.role === 'offer') this.secret = this.paired ? this.peer.secret : toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
          this.sayHello();
          // Everything after the handshake waits for this message, so it is said again until the other side has answered.
          let tries = 0;
          const again = setInterval(() => {
            if (this.peerInfo || !this.dc || this.dc.readyState !== 'open' || ++tries > HELLO_TRIES) { clearInterval(again); return; }
            D.log('p2p', 'hello not answered yet', { role: this.role, tries, channel: this.dc.readyState, connection: this.pc && this.pc.connectionState });
            this.sayHello();
          }, HELLO_RETRY_MS);
        });
        dc.addEventListener('close', () => { if (this.state !== 'failed') this.setState('closed'); this.rejectWaiters(new Error(D.t('p2p.err.connection'))); });
        dc.addEventListener('error', (e) => { this.fail(/** @type {any} */ (e).error || new Error('data channel error')); });
        dc.addEventListener('message', (e) => { this.onMessage(e.data).catch((err) => this.fail(err)); });
      }
      sayHello() {
        const secret = this.role === 'offer' && !this.paired ? this.secret : undefined;
        this.sendJson({ t: 'hello', v: VERSION, app: 'dataspatium', version: D.version, name: this.name, fp: this.fingerprint, secret, paired: this.paired, seen: !!this.peerInfo });
      }
      sendJson(obj) { if (this.dc && this.dc.readyState === 'open') this.dc.send(JSON.stringify(obj)); }
      waitFor(type, timeoutMs = 0) {
        return new Promise((resolve, reject) => {
          const entry = { resolve, reject, timer: 0 };
          if (!this.waiters.has(type)) this.waiters.set(type, []);
          this.waiters.get(type).push(entry);
          if (timeoutMs) entry.timer = setTimeout(() => { reject(new Error(D.t('p2p.err.timeout'))); }, timeoutMs);
        });
      }
      resolveWaiters(type, value) {
        const list = this.waiters.get(type) || [];
        this.waiters.delete(type);
        for (const w of list) { clearTimeout(w.timer); w.resolve(value); }
      }

      async onMessage(data) {
        if (typeof data === 'string') {
          const msg = JSON.parse(data);
          switch (msg.t) {
            case 'hello': {
              const firstTime = !this.peerInfo;
              this.peerInfo = { name: msg.name, fingerprint: msg.fp, version: msg.version, paired: !!msg.paired };
              if (msg.secret && this.role === 'answer') this.secret = msg.secret;
              if (this.remote && msg.fp && msg.fp !== this.remote.fingerprint) { this.fail(new Error(D.t('p2p.err.fingerprint'))); return; }
              if (this.paired && this.peer) touchPeer(this.peer.id, { name: msg.name }).catch(() => {});
              // The other side says whether it has heard this side; if not, it hears it now.
              if (!msg.seen) this.sayHello();
              if (firstTime) this.emit('hello', this.peerInfo);
              break;
            }
            case 'paired':
              // The offerer confirmed the verification code and stored us; store the offerer too (both sides keep the secret).
              if (this.role === 'answer' && this.secret && this.peerInfo && !this.paired) { try { await this.pairPeer(); } catch (err) { D.log('p2p', 'pairing failed', err); } }
              this.emit('paired', msg);
              break;
            case 'offer': {
              const items = (msg.items || []).map((it) => Object.assign({}, it, { have: (partials.get(it.sha256) || { received: 0 }).received }));
              this.pendingOffer = items;
              this.emit('offer', { items, accept: (ids) => this.acceptItems(ids || items.map((i) => i.id)), reject: () => this.sendJson({ t: 'reject' }) });
              break;
            }
            case 'accept': this.resolveWaiters('accept', msg); break;
            case 'reject': this.resolveWaiters('accept', { t: 'reject', ids: [] }); break;
            case 'begin': {
              const item = (this.pendingOffer || []).find((i) => i.id === msg.id);
              if (!item) { this.fail(new Error('unexpected item ' + msg.id)); return; }
              const partial = partials.get(item.sha256) || { chunks: [], received: 0 };
              if (msg.offset !== partial.received) { partial.chunks = []; partial.received = 0; }
              partials.set(item.sha256, partial);
              this.receiving = { item, partial };
              break;
            }
            case 'end': await this.finishItem(msg); break;
            case 'done': this.resolveWaiters('done:' + msg.id, msg); this.emit('delivered', msg); break;
            case 'bye': this.emit('bye', msg); break;
            default: break;
          }
          return;
        }
        if (!this.receiving) return;
        const { item, partial } = this.receiving;
        partial.chunks.push(data);
        partial.received += data.byteLength;
        this.emit('progress', { id: item.id, name: item.name, received: partial.received, size: item.size, direction: 'in' });
      }
      acceptItems(ids) {
        const offsets = {};
        for (const it of this.pendingOffer || []) if (ids.includes(it.id)) offsets[it.id] = it.have || 0;
        this.sendJson({ t: 'accept', ids, offsets });
      }
      async finishItem(msg) {
        const { item, partial } = this.receiving || {};
        this.receiving = null;
        if (!item) return;
        const blob = new Blob(partial.chunks, { type: item.type || 'application/octet-stream' });
        const digest = await sha256(await blob.arrayBuffer());
        const ok = digest === item.sha256 && blob.size === item.size;
        if (ok) partials.delete(item.sha256);
        this.sendJson({ t: 'done', id: item.id, ok });
        if (ok) this.emit('item', { id: item.id, name: item.name, type: item.type, size: item.size, kind: item.kind, meta: item.meta, blob });
        else this.emit('error', new Error(D.t('p2p.err.checksum', { name: item.name })));
      }

      /**
       * Send items; resolves when the receiver has confirmed every accepted item.
       * @param {Array<{id?: string, name: string, type?: string, data: Blob|ArrayBuffer, kind?: string, meta?: any}>} items
       */
      async send(items) {
        if (!this.dc || this.dc.readyState !== 'open') throw new Error(D.t('p2p.err.notconnected'));
        const prepared = [];
        for (const it of items) {
          const buffer = it.data instanceof Blob ? await it.data.arrayBuffer() : it.data;
          prepared.push({ id: it.id || randomChars(10), name: it.name, type: it.type || (it.data instanceof Blob ? it.data.type : '') || 'application/octet-stream', size: buffer.byteLength, sha256: await sha256(buffer), kind: it.kind || 'file', meta: it.meta || null, buffer });
        }
        this.sendJson({ t: 'offer', items: prepared.map(({ buffer, ...rest }) => rest) });
        const reply = await this.waitFor('accept');
        if (reply.t === 'reject' || !reply.ids || !reply.ids.length) { this.emit('rejected', reply); return { accepted: [], confirmed: [] }; }
        const confirmed = [];
        for (const item of prepared) {
          if (!reply.ids.includes(item.id)) continue;
          const offset = Math.min(Number((reply.offsets || {})[item.id]) || 0, item.size);
          this.sendJson({ t: 'begin', id: item.id, offset });
          for (let pos = offset; pos < item.size; pos += CHUNK) {
            if (this.dc.bufferedAmount > HIGH_WATER) await this.drain();
            if (this.dc.readyState !== 'open') throw new Error(D.t('p2p.err.connection'));
            this.dc.send(item.buffer.slice(pos, Math.min(pos + CHUNK, item.size)));
            this.emit('progress', { id: item.id, name: item.name, received: Math.min(pos + CHUNK, item.size), size: item.size, direction: 'out' });
          }
          this.sendJson({ t: 'end', id: item.id });
          const done = await this.waitFor('done:' + item.id);
          if (!done.ok) throw new Error(D.t('p2p.err.checksum', { name: item.name }));
          confirmed.push(item.id);
        }
        return { accepted: reply.ids, confirmed };
      }
      drain() {
        return new Promise((resolve) => {
          const dc = this.dc;
          if (!dc || dc.bufferedAmount <= LOW_WATER) { resolve(); return; }
          const onLow = () => { dc.removeEventListener('bufferedamountlow', onLow); resolve(); };
          dc.addEventListener('bufferedamountlow', onLow);
          setTimeout(onLow, 2000);
        });
      }

      /** Remember the peer with the secret agreed in this session (after the verification code was compared). */
      async pairPeer() {
        if (!this.peerInfo || !this.secret) throw new Error(D.t('p2p.err.notconnected'));
        await pair({ id: this.peerInfo.fingerprint, name: this.peerInfo.name || '', secret: this.secret });
        this.paired = true;
        if (this.role === 'offer') this.sendJson({ t: 'paired' });
      }
      close() {
        try { this.sendJson({ t: 'bye' }); } catch (_err) { /* ignore */ }
        try { if (this.dc) this.dc.close(); } catch (_err) { /* ignore */ }
        try { if (this.pc) this.pc.close(); } catch (_err) { /* ignore */ }
        this.rejectWaiters(new Error('closed'));
        this.setState('closed');
      }
    }

    /** Offerer side (computer): shows a code or QR and waits. */
    function offer(options = {}) { const s = new Session({ role: 'offer', config: options.config, certificate: options.certificate }); s.startOffer(options).catch(() => {}); return s; }
    /** Answerer side (phone or second computer): connects to an offer code. */
    function answer(offerPayload, options = {}) { const s = new Session({ role: 'answer', config: options.config, certificate: options.certificate }); s.answer(offerPayload).catch(() => {}); return s; }
    function supported() { return typeof RTCPeerConnection === 'function' && typeof RTCPeerConnection.generateCertificate === 'function' && !!(globalThis.crypto && crypto.subtle); }

    return {
      Session, offer, answer, supported, identity, deviceName, setDeviceName, peers, peerById, pair, forget, mobileUrl,
      encodePayload, decodePayload, buildSdp, hostCandidates, deriveCredentials, verificationCode, toBase32, fromBase32, groupCode, sha256,
      CHUNK, VERSION, MOBILE_URL, SETTING_MOBILE_URL,
    };
  });
})();
