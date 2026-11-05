// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The one dialog for reading text in pictures, whichever view asks: says what will happen, lets the user choose the language,
 * and shows how far it has come. Stopping keeps what has been read.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/kinds/ocr-dialog', ['ui/base', 'engines/ocr'], (base, engine) => {
    const { h, t, i18n, replace } = base;
    const LANGUAGE_KEY = 'dataspatium.ocr.language';

    const remembered = () => {
      try { return localStorage.getItem(LANGUAGE_KEY) || ''; } catch (_err) { return ''; }
    };
    const remember = (code) => { try { localStorage.setItem(LANGUAGE_KEY, code); } catch (_err) { /* only a convenience */ } };

    /**
     * @param {any} ctx shell context
     * @param {{title: string, lead: string, progress: (done: number, total: number) => string, run: (o: {language: string, onProgress: (done: number, total: number) => void, signal: {stop: boolean}}, file?: File|Blob) => Promise<any>, file?: Blob|null, pick?: boolean}} options
     *   `pick` asks for a picture and `file` is one already given.
     * @returns {Promise<any>} what `run` gave, or null when nothing was done
     */
    async function open(ctx, options) {
      const { ui } = ctx;
      const signal = { stop: false };
      let running = null;
      const language = /** @type {any} */ (h('dm-select', { label: t('ocr.language') }));
      language.options = i18n.LANGUAGES.filter((l) => engine.LANGUAGES[l.code]).map((l) => ({ value: l.code, label: l.label }));
      language.value = engine.LANGUAGES[remembered()] ? remembered() : (engine.LANGUAGES[i18n.language()] ? i18n.language() : 'sv');
      const size = h('p', { class: 'dm-help dm-small', text: t('ocr.local', { size: i18n.formatBytes(engine.downloadSize(language.value)) }) });
      language.addEventListener('change', () => { size.textContent = t('ocr.local', { size: i18n.formatBytes(engine.downloadSize(language.value)) }); });
      const stateEl = h('div', { class: 'dm-stack-sm', 'data-ocr-state': '' });

      /** @param {(value: any) => void} finish @param {Blob} [file] */
      function start(finish, file) {
        remember(language.value);
        const progress = /** @type {any} */ (h('dm-progress', { value: '0', label: t('ocr.running') }));
        const note = h('p', { class: 'dm-help dm-small', text: t('ocr.running') });
        replace(stateEl, progress, note);
        const onProgress = (done, total) => {
          progress.setAttribute('value', String(total ? Math.round((done / total) * 100) : 0));
          note.textContent = options.progress(done, total);
        };
        // First what has to be fetched, which is where consent is asked for, then the work itself.
        running = engine.prepare(language.value, { onProgress: (info) => { note.textContent = t('ocr.fetching', { size: i18n.formatBytes(info.received) }); } })
          .then(() => options.run({ language: language.value, onProgress, signal }, file))
          .then((result) => { finish(result); return result; })
          .catch((err) => {
            D.log('ocr', err);
            const text = String((err && err.message) || err);
            replace(stateEl, h('p', { class: 'dm-error dm-small', 'data-ocr-error': '', text: t('ocr.err.reading', { detail: text }) }));
            if (signal.stop) ui.toast.show(text, { kind: 'error' });
            return null;
          })
          .finally(() => engine.terminate());
      }
      const chosen = await ui.dialog.open({
        title: options.title, help: 'dokument#läsa-text-i-bilder', actions: [{ label: t('common.cancel'), value: null }],
        body: (finish) => {
          let action = null;
          if (options.pick) {
            action = h('dm-dropzone', { text: t('ocr.pick'), hint: t('ocr.pick.hint'), accept: 'image/*' });
            action.addEventListener('dm-files', (e) => { const f = /** @type {any} */ (e).detail.files[0]; if (f) start(finish, f); });
          } else action = h('div', { class: 'dm-row' }, ui.button({ label: t('ocr.read'), variant: 'primary', icon: 'scan-line', onClick: () => start(finish, options.file || undefined) }));
          return h('div', { class: 'dm-stack' }, h('p', { text: options.lead }), language, size, action, stateEl);
        },
      });
      if (chosen) return chosen;
      // Cancelled: what has been read so far is kept, and the worker's memory is freed afterwards.
      signal.stop = true;
      return running;
    }

    return { open };
  });
})();
