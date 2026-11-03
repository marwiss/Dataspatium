// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * <dm-code language="r|sql|json|latex" placeholder="…" label="…"> code editor built on CodeMirror 5, which ships
 * as classic scripts and therefore works under file://. The library and language modes load lazily
 * the first time an editor is created. Ctrl+Enter / Cmd+Enter emits `dm-run`.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/code-editor', ['ui/base'], (base) => {
    const { h, t, DmElement, define } = base;
    const BASE = 'vendor/codemirror5/';
    const MODES = { r: { file: 'mode/r/r.js', mime: 'text/x-rsrc' }, sql: { file: 'mode/sql/sql.js', mime: 'text/x-sqlite' }, json: { file: 'mode/javascript/javascript.js', mime: 'application/json' }, latex: { file: 'mode/stex/stex.js', mime: 'text/x-stex' } };
    let corePromise = null;
    const modePromises = new Map();

    function loadCore() {
      if (!corePromise) {
        corePromise = (async () => {
          if (!document.querySelector('link[data-dm-cm]')) {
            document.head.appendChild(h('link', { rel: 'stylesheet', href: (globalThis.DATASPATIUM_BASE || '') + BASE + 'lib/codemirror.css', 'data-dm-cm': '' }));
          }
          await D.assets.loadVendorScript(BASE + 'lib/codemirror.js');
          for (const addon of ['addon/edit/matchbrackets.js', 'addon/edit/closebrackets.js', 'addon/display/placeholder.js', 'addon/selection/active-line.js', 'addon/comment/comment.js']) {
            await D.assets.loadVendorScript(BASE + addon);
          }
          return /** @type {any} */ (globalThis).CodeMirror;
        })();
      }
      return corePromise;
    }
    async function loadMode(language) {
      const mode = MODES[language];
      if (!mode) return null;
      if (!modePromises.has(language)) modePromises.set(language, loadCore().then(() => D.assets.loadVendorScript(BASE + mode.file)));
      await modePromises.get(language);
      return mode.mime;
    }

    class DmCode extends DmElement {
      static get observedAttributes() { return ['language', 'readonly']; }
      constructor() { super(); this.pendingValue = null; this.cm = null; }
      connectedCallback() {
        if (this.ready) return;
        this.ready = this.build();
      }
      async build() {
        const CodeMirror = await loadCore();
        const language = this.attr('language', 'r');
        const mime = await loadMode(language);
        if (!this.isConnected) return;
        const run = () => this.emit('dm-run', { code: this.value, selection: this.selection });
        this.cm = CodeMirror(this, {
          value: this.pendingValue !== null ? this.pendingValue : (this.getAttribute('value') || ''),
          mode: mime || null,
          lineNumbers: true,
          lineWrapping: true,
          matchBrackets: true,
          autoCloseBrackets: true,
          styleActiveLine: true,
          indentUnit: 2,
          tabSize: 2,
          placeholder: this.attr('placeholder', ''),
          readOnly: this.hasFlag('readonly'),
          viewportMargin: 20,
          extraKeys: { 'Ctrl-Enter': run, 'Cmd-Enter': run, 'Shift-Enter': run, 'Ctrl-/': 'toggleComment', 'Cmd-/': 'toggleComment', Tab: (cm) => cm.execCommand(cm.somethingSelected() ? 'indentMore' : 'insertSoftTab') },
        });
        this.cm.on('change', () => this.emit('dm-change', { code: this.value }));
        // CodeMirror types into a hidden textarea; it carries the editor's name for screen readers.
        this.cm.getInputField().setAttribute('aria-label', this.getAttribute('label') || t('code.editor.' + (MODES[language] ? language : 'other')));
        this.pendingValue = null;
        this.emit('dm-ready', {});
      }
      attributeChangedCallback(name) {
        if (!this.cm) return;
        if (name === 'readonly') this.cm.setOption('readOnly', this.hasFlag('readonly'));
        if (name === 'language') loadMode(this.attr('language', 'r')).then((mime) => this.cm && this.cm.setOption('mode', mime || null));
      }
      get value() { return this.cm ? this.cm.getValue() : (this.pendingValue !== null ? this.pendingValue : (this.getAttribute('value') || '')); }
      set value(v) { if (this.cm) this.cm.setValue(v === null || v === undefined ? '' : String(v)); else this.pendingValue = String(v === null || v === undefined ? '' : v); }
      /** Selected text, or the current line when nothing is selected. */
      get selection() {
        if (!this.cm) return '';
        const sel = this.cm.getSelection();
        return sel || this.cm.getLine(this.cm.getCursor().line);
      }
      insert(text) { if (this.cm) { this.cm.replaceSelection(text); this.cm.focus(); } else this.pendingValue = (this.pendingValue || '') + text; }
      focus() { if (this.cm) this.cm.focus(); }
      refresh() { if (this.cm) this.cm.refresh(); }
    }
    define('dm-code', DmCode);
    return { DmCode, loadCore, loadMode };
  });
})();
