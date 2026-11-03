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
 * Until the message with `final: true` arrives, messages addressed to the hosted code are queued,
 * so the hosted code never sees a request before its assets are present.
 */

/**
 * Build an XMLHttpRequest replacement that serves `dataspatium-asset://` URLs from the asset map and
 * delegates everything else to the real XMLHttpRequest. Standalone: safe to stringify.
 * @param {any} RealXHR
 * @param {(name: string) => any} lookupSync returns {kind, data} or null
 * @param {(name: string) => Promise<any>} lookupAsync rejects when the asset is missing
 * @param {(url: string) => string|null} assetName
 * @param {(name: string) => string} mimeFor
 */
function dataspatiumMakeXHR(RealXHR, lookupSync, lookupAsync, assetName, mimeFor) {
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
        if (st.name === null) {
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
 * @param {{namespace: string, name?: string}} config
 * @param {typeof dataspatiumMakeXHR} makeXHR
 */
function dataspatiumWorkerShim(config, makeXHR) {
  'use strict';
  var SCHEME = 'dataspatium-asset://';
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
    var s = String(url);
    if (s.indexOf(SCHEME) !== 0) return null;
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
  function lookupSync(name) {
    var entry = assets.get(name);
    if (entry) return entry;
    var fs = self.Module && self.Module.FS;
    if (!fs) return null;
    try {
      var bytes = fs.readFile(FS_ASSETS + encodeURIComponent(name));
      entry = { kind: 'binary', data: bytes.slice().buffer };
      assets.set(name, entry);
      try { fs.unlink(FS_ASSETS + encodeURIComponent(name)); } catch (e) { /* keep it */ }
      return entry;
    } catch (e) { return null; }
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
    }
  }
  function route(ev) {
    var d = ev.data;
    if (d && d.__dm === true) { control(d); return; }
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
  realAdd('message', route);

  // --- importScripts: evaluate asset text in the global scope
  var realImportScripts = self.importScripts;
  self.importScripts = function () {
    for (var i = 0; i < arguments.length; i++) {
      var url = String(arguments[i]);
      var name = assetName(url);
      if (name === null) { realImportScripts.call(self, url); continue; }
      var entry = lookupSync(name);
      if (!entry) throw new Error('Dataspatium: asset not loaded for importScripts: ' + name);
      (0, eval)(toText(entry) + '\n//# sourceURL=' + SCHEME + name);
    }
  };

  // --- fetch
  var realFetch = self.fetch.bind(self);
  self.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && typeof input.url === 'string' ? input.url : String(input));
    var name = assetName(url);
    if (name === null) return realFetch(input, init);
    return lookupAsync(name).then(function (entry) {
      var buf = toBuffer(entry);
      return new Response(buf.slice(0), { status: 200, statusText: 'OK', headers: { 'Content-Type': mimeFor(name), 'Content-Length': String(buf.byteLength) } });
    }, function () {
      return new Response('Not found: ' + name, { status: 404, statusText: 'Not Found' });
    });
  };

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
  self.XMLHttpRequest = makeXHR(self.XMLHttpRequest, lookupSync, lookupAsync, assetName, mimeFor);

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
  };
  send({ type: 'hello', namespace: config.namespace });
}

(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  /**
   * Compose the full source text of a shimmed worker.
   * @param {{namespace: string, name?: string}} config
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
