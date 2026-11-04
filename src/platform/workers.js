// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Worker management on the main thread.
 *
 * Replaces the global `Worker` with a subclass that (a) filters the shim's control messages
 * (`__dm: true`) out of the message stream the hosted code sees, and (b) answers them: on `hello`
 * it sends the assets registered for the worker's namespace, on `asset-request` it loads and sends a
 * single asset. Third-party code that creates workers itself (webR) therefore gets the shim's
 * services without knowing about Dataspatium.
 *
 * `Dataspatium.workers.create()` builds Dataspatium's own Blob workers from a standalone function.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  const RealWorker = globalThis.Worker;
  /** @type {Map<string, {initial?: () => Promise<any[]>, request?: (name: string) => Promise<boolean>}>} */
  const providers = new Map();
  const live = new Set();
  const CHUNK = 16;

  /**
   * Turn asset names (or ready-made entries) into transferable entries.
   * @param {any[]} items names or {name, kind, data}
   */
  async function collectEntries(items) {
    const entries = [];
    const transfer = [];
    for (const item of items) {
      if (typeof item === 'string') {
        let e = await D.assets.decode(item);
        if (e.kind === 'binary') {
          // The buffer is handed over to the worker. Two workers asking for the same asset at once (two SQLite
          // engines opening together) share one decode; the first send takes the entry and detaches the buffer when
          // it posts, so the second decodes a fresh copy (the wrapper is injected again) instead of failing with
          // "ArrayBuffer is already detached".
          if (!D.assets.take(item)) { e = await D.assets.decode(item); D.assets.take(item); }
          transfer.push(e.data);
        }
        entries.push({ name: item, kind: e.kind, data: e.data });
      } else {
        entries.push({ name: item.name, kind: item.kind, data: item.data });
        if (item.kind === 'binary' && item.transfer !== false) transfer.push(item.data);
      }
    }
    return { entries, transfer };
  }

  function rawPost(worker, message, transfer) {
    RealWorker.prototype.postMessage.call(worker, message, transfer || []);
  }

  async function sendAssets(worker, items, final) {
    const { entries, transfer } = await collectEntries(items);
    rawPost(worker, { __dm: true, type: 'assets', entries, final: !!final }, transfer);
  }

  async function handleControl(worker, msg) {
    if (msg.type === 'hello') {
      worker.dmNamespace = msg.namespace;
      const provider = providers.get(msg.namespace);
      let items = [];
      try {
        if (provider && provider.initial) items = await provider.initial();
      } catch (err) {
        console.error('[workers] asset provider failed for', msg.namespace, err);
      }
      D.log('workers', 'hello from', msg.namespace, '->', items.length, 'assets');
      if (items.length === 0) { rawPost(worker, { __dm: true, type: 'assets', entries: [], final: true }); return; }
      for (let i = 0; i < items.length; i += CHUNK) {
        await sendAssets(worker, items.slice(i, i + CHUNK), i + CHUNK >= items.length);
      }
    } else if (msg.type === 'asset-request') {
      const provider = providers.get(worker.dmNamespace);
      try {
        if (provider && provider.request && (await provider.request(msg.name)) === false) throw new Error('refused by provider');
        await sendAssets(worker, [msg.name], false);
      } catch (err) {
        D.log('workers', 'asset missing', msg.name, err);
        rawPost(worker, { __dm: true, type: 'asset-missing', name: msg.name });
      }
    }
  }

  class DataspatiumWorker extends RealWorker {
    /** @param {string|URL} url @param {WorkerOptions} [options] */
    constructor(url, options) {
      super(url, options);
      this.dmNamespace = null;
      /** @type {((this: Worker, ev: MessageEvent) => any)|null} */
      this.dmHandler = null;
      /** @type {Function[]} */
      this.dmListeners = [];
      live.add(this);
      super.addEventListener('message', (ev) => this.dmRoute(/** @type {MessageEvent} */ (ev)));
    }
    /** @param {MessageEvent} ev */
    dmRoute(ev) {
      const d = ev.data;
      if (d && d.__dm === true) { handleControl(this, d); return; }
      if (this.dmHandler) this.dmHandler.call(this, ev);
      for (const fn of this.dmListeners) fn.call(this, ev);
    }
    // @ts-ignore accessor intentionally shadows Worker.prototype.onmessage
    get onmessage() { return this.dmHandler; }
    set onmessage(fn) { this.dmHandler = typeof fn === 'function' ? fn : null; }
    addEventListener(type, fn, options) {
      if (type === 'message') { this.dmListeners.push(fn); return; }
      super.addEventListener(type, fn, options);
    }
    removeEventListener(type, fn, options) {
      if (type === 'message') { this.dmListeners = this.dmListeners.filter((x) => x !== fn); return; }
      super.removeEventListener(type, fn, options);
    }
    terminate() { live.delete(this); super.terminate(); }
  }
  globalThis.Worker = /** @type {any} */ (DataspatiumWorker);

  /**
   * Create one of Dataspatium's own shimmed workers.
   * @param {{namespace: string, source: string, name?: string}} options
   */
  function create(options) {
    const text = D.workerShim.buildWorkerSource({ namespace: options.namespace, name: options.name || options.namespace }, options.source);
    const url = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
    const worker = /** @type {any} */ (new DataspatiumWorker(url, { name: options.name || options.namespace }));
    worker.dmBlobUrl = url;
    return worker;
  }

  /** Serialise a standalone named function as worker source that runs it. */
  function functionSource(fn) {
    if (!fn.name) throw new Error('Worker functions must be named');
    return fn.toString() + '\n;' + fn.name + '();\n';
  }

  D.workers = {
    /** Register which assets a namespace receives on hello, and how misses are handled. */
    provider(namespace, provider) { providers.set(namespace, provider); },
    create,
    functionSource,
    sendAssets,
    rawPost,
    list: () => Array.from(live),
  };
  D.define('platform/workers', [], () => D.workers);
})();
