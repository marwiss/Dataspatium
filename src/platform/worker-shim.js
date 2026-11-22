// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Worker shim: lets a classic Blob worker load code and binaries from an in-memory asset map
 * instead of the network. Needed because pages opened via file:// cannot fetch local files and,
 * in Chromium, workers cannot even read blob: URLs created by the page.
 *
 * The two functions below are standalone (no references to this file's scope) so that they can be
 * serialised with Function.prototype.toString() and prepended to the hosted worker code
 * (webR's worker, the sql.js worker, ...). The hosted code keeps using fetch(), XMLHttpRequest and
 * importScripts() unchanged; URLs with the scheme `dataspatium-asset://` are served from the map.
 *
 * Protocol between main thread and worker (messages tagged `__dm: true`):
 *   worker -> main  {type: 'hello', namespace}         shim installed, asks for its initial assets
 *   main -> worker  {type: 'assets', entries, final}   entries: [{name, kind: 'text'|'binary', data}]
 *   worker -> main  {type: 'asset-request', name}      async lookup miss (fetch / async XHR only)
 *   main -> worker  {type: 'asset-missing', name}
 *   worker -> main  {type: 'net', id, url, method}     net 'fetch': may the hosted code fetch this address?
 *   main -> worker  {type: 'net-reply', id, url, ok, ticket}
 *   worker -> main  {type: 'net-done', ticket, status} the allowed fetch has ended (for the network log)
 * Until the message with `final: true` arrives, messages addressed to the hosted code are queued,
 * so the hosted code never sees a request before its assets are present. The worker acts on a control message only when the
 * browser delivers it from the main thread (a trusted event); code in the worker can post control messages, but the main thread
 * only answers them.
 */

/**
 * Build an XMLHttpRequest replacement that serves `dataspatium-asset://` URLs from the asset map and
 * delegates everything else to the real XMLHttpRequest. Standalone: safe to stringify.
 * With `net` (a worker without internet access) every other URL is refused at send() with a NetworkError and no real
 * XMLHttpRequest is ever made: a real one, even for a blob: URL, would hand its native class to the code through `constructor`
 * and event targets. Refusing at send() rather than open() keeps callers that open outside a try (webR) running.
 * @param {any} RealXHR
 * @param {(name: string) => any} lookupSync returns {kind, data} or null
 * @param {(name: string) => Promise<any>} lookupAsync rejects when the asset is missing
 * @param {(url: string) => string|null} assetName
 * @param {(name: string) => string} mimeFor
 * @param {{refuse: (url: string) => string}|null} [net] gives the message for a refused URL
 */
function dataspatiumMakeXHR(RealXHR, lookupSync, lookupAsync, assetName, mimeFor, net) {
  'use strict';
  var FORWARDED = ['onreadystatechange', 'onload', 'onerror', 'onabort', 'onloadend', 'onloadstart', 'onprogress', 'ontimeout', 'responseType', 'timeout', 'withCredentials'];
  function toBytes(entry) { return entry.kind === 'text' ? new TextEncoder().encode(entry.data) : new Uint8Array(entry.data); }
  function AssetXHR() {
    var real = null;
    var st = { method: 'GET', url: '', async: true, name: null, reqHeaders: {}, resHeaders: {}, readyState: 0, status: 0, statusText: '', response: null, responseText: '', responseURL: '', responseType: '', timeout: 0, withCredentials: false, listeners: {} };
    var proxy;
    function fire(type) {
      var ev = { type: type, target: proxy, currentTarget: proxy, lengthComputable: false, loaded: 0, total: 0 };
      var handler = st['on' + type];
      if (typeof handler === 'function') handler.call(proxy, ev);
      var list = st.listeners[type] || [];
      for (var i = 0; i < list.length; i++) list[i].call(proxy, ev);
    }
    function complete(entry) {
      if (!entry) {
        st.status = 404; st.statusText = 'Not Found';
        st.resHeaders = { 'content-type': 'text/plain', 'content-length': '0' };
        st.responseText = '';
        st.response = (st.responseType === '' || st.responseType === 'text') ? '' : null;
      } else {
        var bytes = toBytes(entry);
        var total = bytes.byteLength;
        st.resHeaders = { 'content-type': mimeFor(st.name), 'content-length': String(total) };
        var range = st.reqHeaders['range'];
        var m = range ? /^bytes=(\d+)-(\d*)$/.exec(range) : null;
        if (m) {
          var from = Number(m[1]);
          var to = m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1);
          bytes = bytes.slice(from, to + 1);
          st.status = 206; st.statusText = 'Partial Content';
          st.resHeaders['content-range'] = 'bytes ' + from + '-' + to + '/' + total;
          st.resHeaders['content-length'] = String(bytes.byteLength);
        } else {
          st.status = 200; st.statusText = 'OK';
        }
        if (st.method === 'HEAD') {
          st.response = ''; st.responseText = '';
        } else {
          var rt = st.responseType;
          if (rt === '' || rt === 'text') {
            st.responseText = (entry.kind === 'text' && st.status === 200) ? entry.data : new TextDecoder().decode(bytes);
            st.response = st.responseText;
          } else if (rt === 'arraybuffer') {
            st.response = bytes.slice().buffer; // private copy: consumers may detach or mutate it
          } else if (rt === 'json') {
            try { st.response = JSON.parse(new TextDecoder().decode(bytes)); } catch (e) { st.response = null; }
          } else if (rt === 'blob') {
            st.response = new Blob([bytes], { type: st.resHeaders['content-type'] });
          } else {
            st.response = bytes.slice().buffer;
          }
        }
      }
      st.responseURL = st.url;
      st.readyState = 4;
      fire('readystatechange');
      fire('load');
      fire('loadend');
    }
    var facade = {
      open: function (method, url, async) {
        st.method = String(method).toUpperCase();
        st.url = String(url);
        st.async = async !== false;
        st.name = assetName(st.url);
        st.refused = st.name === null && !!net;
        if (st.name === null && !st.refused) {
          real = new RealXHR();
          for (var i = 0; i < FORWARDED.length; i++) {
            var key = FORWARDED[i];
            if (st[key] !== undefined && st[key] !== null && st[key] !== '' && st[key] !== 0 && st[key] !== false) real[key] = st[key];
          }
          var types = Object.keys(st.listeners);
          for (var j = 0; j < types.length; j++) {
            var fns = st.listeners[types[j]];
            for (var q = 0; q < fns.length; q++) real.addEventListener(types[j], fns[q]);
          }
          return real.open.apply(real, arguments);
        }
        st.readyState = 1;
        fire('readystatechange');
      },
      setRequestHeader: function (key, value) { st.reqHeaders[String(key).toLowerCase()] = String(value); },
      send: function () {
        if (st.refused) {
          st.readyState = 4; st.status = 0;
          throw new DOMException(net.refuse(st.url), 'NetworkError');
        }
        if (st.async) {
          lookupAsync(st.name).then(function (entry) { complete(entry); }, function () { complete(null); });
        } else {
          complete(lookupSync(st.name));
        }
      },
      abort: function () { st.readyState = 0; },
      getResponseHeader: function (key) { var v = st.resHeaders[String(key).toLowerCase()]; return v === undefined ? null : v; },
      getAllResponseHeaders: function () {
        return Object.keys(st.resHeaders).map(function (k) { return k + ': ' + st.resHeaders[k] + '\r\n'; }).join('');
      },
      overrideMimeType: function () {},
      addEventListener: function (type, fn) { (st.listeners[type] = st.listeners[type] || []).push(fn); },
      removeEventListener: function (type, fn) {
        var list = st.listeners[type];
        if (list) st.listeners[type] = list.filter(function (x) { return x !== fn; });
      },
      dispatchEvent: function () { return true; },
    };
    proxy = new Proxy(facade, {
      get: function (target, prop) {
        if (real) { var v = real[prop]; return typeof v === 'function' ? v.bind(real) : v; }
        if (Object.prototype.hasOwnProperty.call(facade, prop)) return facade[prop];
        if (prop === 'upload') return { addEventListener: function () {}, removeEventListener: function () {} };
        if (prop === 'responseXML') return null;
        return st[prop];
      },
      set: function (target, prop, value) { if (real) { real[prop] = value; } else { st[prop] = value; } return true; },
      has: function (target, prop) { return real ? (prop in real) : (prop in facade || prop in st); },
    });
    return proxy;
  }
  AssetXHR.UNSENT = 0; AssetXHR.OPENED = 1; AssetXHR.HEADERS_RECEIVED = 2; AssetXHR.LOADING = 3; AssetXHR.DONE = 4;
  return AssetXHR;
}

/**
 * Install the asset shim inside a worker. Standalone: safe to stringify.
 * `config.net` takes the internet away from the hosted code. With 'none' (R) fetch, XMLHttpRequest and importScripts refuse
 * every URL that is not an asset, a blob or a data URL (XMLHttpRequest serves assets only), and WebSocket, WebSocketStream,
 * WebTransport, EventSource, Worker, SharedWorker, BroadcastChannel, caches, indexedDB and navigator.storage read as undefined,
 * ignoring assignments. 'fetch' (Python) is the same, except that fetch asks the main thread first, which asks for the user's
 * consent (platform/workers, the namespace's `net`), and that Worker and SharedWorker are stand-ins that start nothing.
 * `config.netText` is the message, in the user's language, with {api} for the refused interface. Without `net` nothing changes.
 * The checks call only built-ins taken before the hosted code runs, and fetch and importScripts replace the native ones on the
 * prototype too, so that code in the worker can neither bend a check nor reach around it.
 * @param {{namespace: string, name?: string, net?: 'none'|'fetch', netText?: string}} config
 * @param {typeof dataspatiumMakeXHR} makeXHR
 */
function dataspatiumWorkerShim(config, makeXHR) {
  'use strict';
  var SCHEME = 'dataspatium-asset://';
  // Built-ins taken now, before any hosted code runs: called through these, they cannot be patched later.
  var uncurry = function (fn) { return Function.prototype.call.bind(fn); };
  var getter = function (obj, key) { var d = Object.getOwnPropertyDescriptor(obj, key); return d && d.get ? uncurry(d.get) : null; };
  var NativePromise = Promise;
  var NativeRequest = self.Request;
  var then = uncurry(Promise.prototype.then);
  var startsWith = uncurry(String.prototype.startsWith);
  var hasOwn = uncurry(Object.prototype.hasOwnProperty);
  var toStr = String;
  var requestUrl = getter(NativeRequest.prototype, 'url');
  var requestMethod = getter(NativeRequest.prototype, 'method');
  var responseStatus = getter(Response.prototype, 'status');
  var messageData = getter(MessageEvent.prototype, 'data');
  // isTrusted is an own, unforgeable property of each event; its getter refuses anything that is not a genuine event.
  var isTrusted = getter(new Event('message'), 'isTrusted') || getter(Event.prototype, 'isTrusted');
  var policy = config.net === 'none' || config.net === 'fetch' ? config.net : null;
  var assets = new Map();
  var pending = new Map();
  var queued = [];
  var ready = false;
  var hostHandler = null;
  var hostListeners = [];
  var readyResolve;
  var readyPromise = new Promise(function (resolve) { readyResolve = resolve; });
  var realPost = self.postMessage.bind(self);
  function send(msg, transfer) { msg.__dm = true; realPost(msg, transfer || []); }
  function assetName(url) {
    var s = toStr(url);
    if (!startsWith(s, SCHEME)) return null;
    return s.slice(SCHEME.length).replace(/[?#].*$/, '').replace(/\/{2,}/g, '/').replace(/^\//, '');
  }
  function mimeFor(name) {
    var ext = name.indexOf('.') >= 0 ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
    switch (ext) {
      case 'wasm': return 'application/wasm';
      case 'js': case 'mjs': return 'text/javascript';
      case 'json': case 'metadata': return 'application/json';
      case 'txt': case 'conf': case 'pem': return 'text/plain';
      default: return 'application/octet-stream';
    }
  }
  // Assets the main thread wrote into the hosted code's file system (webR's Emscripten FS). With webR's
  // SharedArrayBuffer channel this worker waits for R requests and never reads further messages, so assets
  // needed later are written there with webR's FS.writeFile instead (see engines/r ensurePackages).
  var FS_ASSETS = '/dataspatium-assets/';
  // A file written there later replaces what the map holds (a re-sent package index, for example).
  function fromFs(name) {
    var fs = self.Module && self.Module.FS;
    if (!fs) return null;
    try {
      var bytes = fs.readFile(FS_ASSETS + encodeURIComponent(name));
      var entry = { kind: 'binary', data: bytes.slice().buffer };
      assets.set(name, entry);
      try { fs.unlink(FS_ASSETS + encodeURIComponent(name)); } catch (e) { /* keep it */ }
      return entry;
    } catch (e) { return null; }
  }
  function lookupSync(name) {
    return fromFs(name) || assets.get(name) || null;
  }
  function lookupAsync(name) {
    var entry = assets.get(name);
    if (entry) return Promise.resolve(entry);
    return new Promise(function (resolve, reject) {
      var list = pending.get(name);
      if (!list) { list = []; pending.set(name, list); send({ type: 'asset-request', name: name }); }
      list.push({ resolve: resolve, reject: reject });
    });
  }
  function toText(entry) { return entry.kind === 'text' ? entry.data : new TextDecoder().decode(new Uint8Array(entry.data)); }
  function toBuffer(entry) { return entry.kind === 'text' ? new TextEncoder().encode(entry.data).buffer : entry.data; }

  // --- message routing: the hosted code's `self.onmessage = fn` lands in hostHandler
  function dispatch(ev) {
    if (hostHandler) hostHandler.call(self, ev);
    for (var i = 0; i < hostListeners.length; i++) hostListeners[i].call(self, ev);
  }
  function control(d) {
    var i, entry, list;
    if (d.type === 'assets') {
      for (i = 0; i < d.entries.length; i++) {
        entry = d.entries[i];
        assets.set(entry.name, { kind: entry.kind, data: entry.data });
        list = pending.get(entry.name);
        if (list) { pending.delete(entry.name); list.forEach(function (p) { p.resolve(assets.get(entry.name)); }); }
      }
      if (d.final && !ready) {
        ready = true;
        readyResolve();
        var backlog = queued.splice(0);
        for (i = 0; i < backlog.length; i++) dispatch(backlog[i]);
      }
    } else if (d.type === 'asset-missing') {
      list = pending.get(d.name);
      if (list) { pending.delete(d.name); list.forEach(function (p) { p.reject(new Error('Asset not available: ' + d.name)); }); }
    } else if (d.type === 'net-reply' && policy === 'fetch') {
      // The answer counts only for the address it names: code in the worker may have posted a question of its own.
      var asked = asking[d.id];
      if (asked && asked.url === d.url) { delete asking[d.id]; asked.ticket = d.ticket; asked.resolve(d.ok === true); }
      else if (d.ok === true) send({ type: 'net-done', ticket: d.ticket, status: null });
    }
  }
  // Only a message the browser delivers from the main thread is trusted. Code in the worker can call its own handler, dispatch an
  // event, or take a trusted event from a MessageChannel with data of its choice, but at this listener such events are untrusted
  // (dispatchEvent clears isTrusted). Registered first and capturing, it reads each event before any listener of the hosted code.
  function route(ev) {
    var d, trusted = false;
    try { d = messageData(ev); trusted = isTrusted(ev) === true; } catch (e) { d = undefined; }
    if (d !== null && typeof d === 'object' && hasOwn(d, '__dm') && d.__dm === true) { if (trusted) control(d); return; }
    if (policy && !trusted) return;
    if (!ready) { queued.push(ev); return; }
    dispatch(ev);
  }
  Object.defineProperty(self, 'onmessage', {
    configurable: true, enumerable: true,
    get: function () { return hostHandler; },
    set: function (fn) { hostHandler = typeof fn === 'function' ? fn : null; },
  });
  var realAdd = self.addEventListener.bind(self);
  var realRemove = self.removeEventListener.bind(self);
  self.addEventListener = function (type, fn, opts) {
    if (type === 'message') { hostListeners.push(fn); return; }
    return realAdd(type, fn, opts);
  };
  self.removeEventListener = function (type, fn, opts) {
    if (type === 'message') { hostListeners = hostListeners.filter(function (x) { return x !== fn; }); return; }
    return realRemove(type, fn, opts);
  };
  realAdd('message', route, true);

  // --- the internet (config.net): refusals say why in the console too, where webR points R's own messages
  var refused = [];
  /** blob: and data: addresses never leave the browser (`url` is a string). */
  function isLocal(url) { return startsWith(url, 'blob:') || startsWith(url, 'data:'); }
  function refuse(api, url) {
    var text = String(config.netText || 'This worker has no internet access ({api}).').replace('{api}', api);
    refused.push({ api: api, url: String(url) });
    if (refused.length > 20) refused.shift();
    try { console.warn('Dataspatium: ' + text + ' ' + url); } catch (e) { /* no console */ }
    return text;
  }
  /**
   * `key` of `obj` reads as `value` and ignores assignments, also on the prototypes that hold it natively (caches and indexedDB on
   * WorkerGlobalScope.prototype, storage on WorkerNavigator.prototype), where a getter would hand the native object back.
   */
  function pin(obj, key, value) {
    var desc = { get: function () { return value; }, set: function () {}, enumerable: false, configurable: false };
    for (var o = obj; o; o = Object.getPrototypeOf(o)) if (o === obj || hasOwn(o, key)) Object.defineProperty(o, key, desc);
  }
  /**
   * Under 'fetch' a stand-in for Worker and SharedWorker: it starts nothing and fails on the next task like a worker that cannot
   * load. Python packages probe for workers (urllib3 builds a streaming fetcher with Worker.new() in a cross-origin isolated
   * page, the app served from a web server), and an undefined Worker reads as None there, which broke `import requests`.
   */
  function standIn(api) {
    return function (url) {
      var text = refuse(api, url);
      var w = {
        onmessage: null, onerror: null,
        postMessage: function () {}, terminate: function () {},
        addEventListener: function () {}, removeEventListener: function () {}, dispatchEvent: function () { return true; },
      };
      setTimeout(function () {
        if (typeof w.onerror !== 'function') return;
        try { w.onerror.call(w, typeof ErrorEvent === 'function' ? new ErrorEvent('error', { message: text }) : { type: 'error', message: text }); }
        catch (e) { /* the handler's own failure */ }
      }, 0);
      return w;
    };
  }
  if (policy) {
    // Accessors rather than deletions: a global that resolves its constructors lazily cannot bring one back, and hosted code
    // that installs its own (webR's proxies, whose sockets and workers its main thread would open) neither fails nor succeeds.
    // indexedDB, BroadcastChannel and navigator.storage would reach the app's own storage and tabs (consents, connectors, cached
    // components); neither engine needs them, and Emscripten's IndexedDB code (webR's Fetch.init) takes an undefined one as missing.
    ['WebSocket', 'WebSocketStream', 'WebTransport', 'EventSource', 'Worker', 'SharedWorker', 'BroadcastChannel', 'caches', 'indexedDB'].forEach(function (key) {
      pin(self, key, policy === 'fetch' && (key === 'Worker' || key === 'SharedWorker') ? standIn(key) : undefined);
    });
    if (self.navigator) pin(self.navigator, 'storage', undefined);
  }
  /**
   * Put `fn` in place of the native function: on self, and with config.net also on the prototype that holds the native one
   * (WorkerGlobalScope.prototype), so that neither `delete self.fetch` nor WorkerGlobalScope.prototype.fetch.call(self, url)
   * reaches it.
   */
  function replace(key, fn) {
    self[key] = fn;
    if (!policy) return;
    for (var o = Object.getPrototypeOf(self); o; o = Object.getPrototypeOf(o)) {
      if (hasOwn(o, key)) Object.defineProperty(o, key, { value: fn, writable: true, enumerable: true, configurable: true });
    }
  }

  // --- importScripts: evaluate asset text in the global scope
  var nativeImportScripts = uncurry(self.importScripts);
  replace('importScripts', function () {
    for (var i = 0; i < arguments.length; i++) {
      var url = toStr(arguments[i]);
      var name = assetName(url);
      if (name === null && policy && !isLocal(url)) throw new DOMException(refuse('importScripts', url), 'NetworkError');
      if (name === null) { nativeImportScripts(self, url); continue; }
      var entry = lookupSync(name);
      if (!entry) throw new Error('Dataspatium: asset not loaded for importScripts: ' + name);
      (0, eval)(toText(entry) + '\n//# sourceURL=' + SCHEME + name);
    }
  });

  // --- fetch
  var realFetch = self.fetch.bind(self);
  function fromAsset(name) {
    return lookupAsync(name).then(function (entry) {
      var buf = toBuffer(entry);
      return new Response(buf.slice(0), { status: 200, statusText: 'OK', headers: { 'Content-Type': mimeFor(name), 'Content-Length': String(buf.byteLength) } });
    }, function () {
      return new Response('Not found: ' + name, { status: 404, statusText: 'Not Found' });
    });
  }
  function rejected(err) { return new NativePromise(function (resolve, reject) { reject(err); }); }
  // net 'fetch': questions to the main thread, by id, out of reach of the hosted code.
  var asking = Object.create(null);
  var askSeq = 0;
  /** Ask the main thread whether `req` may go out; fetch exactly that Request when the trusted answer allows its address. */
  function askFirst(req, url) {
    var id = ++askSeq;
    var entry = { url: url, ticket: null, resolve: null };
    var answer = new NativePromise(function (resolve) { entry.resolve = resolve; });
    asking[id] = entry;
    send({ type: 'net', id: id, url: url, method: requestMethod(req) });
    return then(answer, function (ok) {
      if (ok !== true) throw new TypeError('Dataspatium: internet access was not allowed for ' + url);
      var res = realFetch(req);
      then(res, function (r) { send({ type: 'net-done', ticket: entry.ticket, status: responseStatus(r) }); },
        function () { send({ type: 'net-done', ticket: entry.ticket, status: null }); });
      return res;
    });
  }
  // With config.net the browser turns the input into a Request once; the address read from it is the one decided on, asked about
  // and fetched, so a Request with an own url, a subclass or an object whose toString differs from its url cannot steer it.
  replace('fetch', function (input, init) {
    var name = typeof input === 'string' ? assetName(input) : null;
    if (name !== null) return fromAsset(name);
    if (!policy) {
      name = assetName(input && typeof input.url === 'string' ? input.url : String(input));
      return name === null ? realFetch(input, init) : fromAsset(name);
    }
    var req;
    try { req = new NativeRequest(input, init); } catch (err) { return rejected(err); }
    var url = requestUrl(req);
    name = assetName(url);
    if (name !== null) return fromAsset(name);
    if (isLocal(url)) return realFetch(req);
    if (policy === 'none') return rejected(new TypeError(refuse('fetch', url)));
    return askFirst(req, url);
  });

  // --- WebAssembly.instantiateStreaming accepts our synthetic Response; fall back to ArrayBuffer otherwise
  if (typeof WebAssembly !== 'undefined' && typeof WebAssembly.instantiateStreaming === 'function') {
    var realStreaming = WebAssembly.instantiateStreaming.bind(WebAssembly);
    WebAssembly.instantiateStreaming = function (source, imports) {
      return Promise.resolve(source).then(function (response) {
        var clone = response.clone();
        return realStreaming(response, imports).catch(function () {
          return clone.arrayBuffer().then(function (buf) { return WebAssembly.instantiate(buf, imports); });
        });
      });
    };
  }

  // --- XMLHttpRequest (sync and async, HEAD and Range supported)
  self.XMLHttpRequest = makeXHR(self.XMLHttpRequest, lookupSync, lookupAsync, assetName, mimeFor,
    policy ? { refuse: function (url) { return refuse('XMLHttpRequest', url); } } : null);

  // --- helpers for Dataspatium's own workers
  self.__dataspatium = {
    config: config,
    ready: readyPromise,
    has: function (name) { return assets.has(name); },
    get: lookupSync,
    getAsync: lookupAsync,
    text: function (name) { var e = lookupSync(name); return e ? toText(e) : null; },
    assetName: assetName,
    send: send,
    /** The last requests refused under config.net, oldest first: [{api, url}]. */
    refused: function () { return refused.slice(); },
  };
  send({ type: 'hello', namespace: config.namespace });
}

(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  /**
   * Compose the full source text of a shimmed worker.
   * @param {{namespace: string, name?: string, net?: 'none'|'fetch', netText?: string}} config see dataspatiumWorkerShim
   * @param {string} hostedSource classic-script source of the code to run inside the worker
   */
  function buildWorkerSource(config, hostedSource) {
    return dataspatiumMakeXHR.toString() + '\n' + dataspatiumWorkerShim.toString() + '\n'
      + 'dataspatiumWorkerShim(' + JSON.stringify(config) + ', dataspatiumMakeXHR);\n;\n'
      + hostedSource + '\n';
  }
  D.workerShim = { buildWorkerSource, makeXHR: dataspatiumMakeXHR };
  D.define('platform/worker-shim', [], () => D.workerShim);
})();
