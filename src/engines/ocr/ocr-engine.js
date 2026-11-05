// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Reading text in pictures with Tesseract, as a component on demand: the engine and the language data are fetched from pinned
 * addresses after consent, checked against SHA-256 and kept in IndexedDB. It runs in a classic Blob worker of its own. The
 * core is used directly, without tesseract.js's wrapper, since that one starts its worker from an address. Tests give an
 * engine of their own through `setEngine`.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;

  /* eslint-disable no-var */
  function dataspatiumOcrWorker() {
    var api = null; var core = null; var loaded = '';
    async function gunzip(bytes) {
      var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    async function start(msg) {
      if (!core) {
        (0, eval)(msg.core + ';self.DataspatiumTesseract = TesseractCore;');
        core = await self.DataspatiumTesseract({});
      }
      var want = msg.languages.map(function (l) { return l.code; }).join('+');
      if (loaded === want) return;
      for (var i = 0; i < msg.languages.length; i++) {
        var l = msg.languages[i];
        core.FS.writeFile(l.code + '.traineddata', await gunzip(new Uint8Array(l.bytes)));
      }
      if (api) api.End();
      api = new core.TessBaseAPI();
      if (api.Init(null, want, 1, undefined) === -1) throw new Error('Tesseract could not start');
      loaded = want;
    }
    function read(msg) {
      // A page is laid out freely. A table is one block where the distance between words says where the columns are.
      api.SetVariable('tessedit_pageseg_mode', msg.table ? '6' : '3');
      api.SetVariable('preserve_interword_spaces', msg.table ? '1' : '0');
      api.SetVariable('user_defined_dpi', '300');
      core.FS.writeFile('/input', new Uint8Array(msg.image));
      if (api.SetImageFile(1, 0) === 1) throw new Error('Tesseract could not read the picture');
      api.Recognize(null);
      var result = { text: api.GetUTF8Text(), confidence: api.MeanTextConf() };
      api.Clear();
      return result;
    }
    self.onmessage = function (ev) {
      var msg = ev.data || {};
      var work = msg.type === 'start' ? start(msg).then(function () { return true; }) : msg.type === 'read' ? Promise.resolve().then(function () { return read(msg); }) : null;
      if (!work) return;
      work.then(function (result) { self.postMessage({ id: msg.id, ok: true, result: result }); }, function (err) { self.postMessage({ id: msg.id, ok: false, error: String((err && err.message) || err) }); });
    };
    self.postMessage({ ready: true });
  }
  /* eslint-enable no-var */

  D.define('engines/ocr', ['platform/components'], (components) => {
    const CORE = { id: 'tesseract-core', urls: ['https://cdn.jsdelivr.net/npm/tesseract.js-core@6.1.2/tesseract-core-simd-lstm.wasm.js'], sha256: '9d7c43fb206dc9f48475228b46bf35f888fa9e6259da2e67d5a75c77049f2dc7', size: 3954569 };
    /** Language data per app language: the app's own languages are the ones it reads. */
    const LANGUAGES = {
      sv: { code: 'swe', sha256: 'b60d9fea7e570d11d6fdf26c8d0ef1d63b49222313773ce66777ed08fa20dc5a', size: 2503095 },
      da: { code: 'dan', sha256: '6af1a07c22894b728ebc75f0fd0c8519eca002cfab6da903eb4d62e24f163abc', size: 1845116 },
      nb: { code: 'nor', sha256: '6c5d91a5b684da387bfcf16b38bae8d94771812dc9ef706b413c728ca1d37c93', size: 2490241 },
      fi: { code: 'fin', sha256: '138c59f6a0bef68fd98d8baf565477f5cdb5198bfc4a68e558efd3b6a57acadd', size: 3795323 },
      is: { code: 'isl', sha256: '002a0b366f0e96c06a65896033b0aabb313c6cc4c6d9c9cca0969dee11ff1f56', size: 1696807 },
      en: { code: 'eng', sha256: '45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91', size: 2952873 },
    };
    const known = (language) => (LANGUAGES[language] ? language : 'sv');
    /** The language with English alongside, since names and terms in English turn up in most documents. */
    const withEnglish = (language) => (known(language) === 'en' ? ['en'] : [known(language), 'en']);
    /** The component for a language's data. @param {string} language */
    function languageSpec(language) {
      const l = LANGUAGES[known(language)];
      return { id: `tesseract-${l.code}`, urls: [`https://cdn.jsdelivr.net/npm/@tesseract.js-data/${l.code}@1.0.0/4.0.0_best_int/${l.code}.traineddata.gz`], sha256: l.sha256, size: l.size, label: D.t('ocr.component.language', { language: D.require('ui/i18n').LANGUAGES.find((x) => x.code === known(language)).label }) };
    }
    let worker = null; let ready = null; let seq = 0; let started = '';
    /** @type {Map<number, {resolve: Function, reject: Function}>} */
    const pending = new Map();
    /** @type {any} */ let replacement = null;

    function ensureWorker() {
      if (worker) return ready;
      D.workers.provider('ocr', { initial: async () => [] });
      worker = D.workers.create({ namespace: 'ocr', source: D.workers.functionSource(dataspatiumOcrWorker), name: 'ocr' });
      ready = new Promise((resolve) => {
        worker.onmessage = (ev) => {
          const msg = ev.data || {};
          if (msg.ready) { resolve(true); return; }
          const p = pending.get(msg.id);
          if (!p) return;
          pending.delete(msg.id);
          if (msg.ok) p.resolve(msg.result); else p.reject(new Error(msg.error));
        };
        worker.onerror = (ev) => { for (const p of pending.values()) p.reject(new Error(String((ev && ev.message) || 'OCR worker'))); pending.clear(); };
      });
      return ready;
    }
    function call(message, transfer) {
      return ensureWorker().then(() => new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject });
        worker.postMessage(Object.assign({ id }, message), transfer || []);
      }));
    }
    /**
     * Get ready to read a language. Fetches what is missing after consent, so this is only called on the user's action.
     * @param {string} language an app language @param {{onProgress?: Function}} [options] @returns {Promise<void>}
     */
    async function prepare(language, options = {}) {
      if (replacement || started === known(language)) return;
      const core = await components.text(Object.assign({ label: D.t('ocr.component.core') }, CORE), options);
      const languages = [];
      for (const code of withEnglish(language)) {
        languages.push({ code: LANGUAGES[code].code, bytes: await components.ensure(languageSpec(code), options) });
      }
      await call({ type: 'start', core, languages }, languages.map((l) => l.bytes));
      started = known(language);
    }
    /**
     * The text in a picture.
     * @param {Blob} image PNG or JPEG @param {{language?: string, table?: boolean, onProgress?: Function}} [options]
     * @returns {Promise<{text: string, confidence: number}>}
     */
    async function read(image, options = {}) {
      if (replacement) return replacement(image, options);
      await prepare(options.language || 'sv', options);
      const bytes = await image.arrayBuffer();
      return call({ type: 'read', image: bytes, table: !!options.table }, [bytes]);
    }
    /** What may have to be fetched the first time, in bytes. @param {string} language @returns {number} */
    const downloadSize = (language) => withEnglish(language).reduce((n, code) => n + LANGUAGES[code].size, CORE.size);
    /** Free the engine's memory. It starts again when something is read. */
    function terminate() { if (worker) { worker.terminate(); worker = null; ready = null; started = ''; } }

    return { read, prepare, downloadSize, terminate, languageSpec, LANGUAGES, CORE, setEngine: (fn) => { replacement = fn; } };
  });
})();
