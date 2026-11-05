// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The library in Hantera: what comes with the app and what the user has fetched from an address, each entry with its licence. The
 * inspector shows what an entry does before it is added, and a recipe asks which dataset it should run on.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/library/library-view', ['ui/base', 'data/library'], (base, library) => {
    const { h, t, replace } = base;
    const ICONS = { recipe: 'list-checks', document: 'file-text', notebook: 'book-open', script: 'file', flow: 'play', connector: 'globe' };

    /** @param {any} ctx shell context */
    function create(ctx) {
      const { ui, store, shell, services } = ctx;
      const s = { libraries: [], at: 0, kind: '', search: '', selected: null, url: '', error: '', busy: false };
      let slots = null; let listEl = null;
      const current = () => s.libraries[s.at] || null;
      const fail = (err) => { shell.log(String((err && err.message) || err), 'error'); ui.toast.show(String((err && err.message) || err), { kind: 'error', timeout: 12000 }); };

      function shown() {
        const lib = current();
        const q = s.search.toLowerCase();
        return (lib ? lib.entries : []).filter((e) => (!s.kind || e.kind === s.kind) && (!q || `${e.name} ${e.description}`.toLowerCase().includes(q)));
      }
      function renderList() {
        if (!listEl) return;
        const found = shown();
        replace(listEl, found.length
          ? h('div', { class: 'dm-list' }, found.map((e) => h('button', { type: 'button', class: 'dm-list-item', 'data-library-entry': e.id, 'aria-current': s.selected === e ? 'true' : 'false', onclick: () => { s.selected = e; renderList(); renderInspector(); } },
            ui.icon(ICONS[e.kind] || 'file', 16),
            h('span', { class: 'dm-list-main' }, h('span', { text: e.name }), h('span', { class: 'dm-list-sub', text: [t(`library.kind.${e.kind}`), e.description].filter(Boolean).join(' · ') })),
            h('dm-badge', { text: e.license }))))
          : h('dm-empty-state', { icon: 'book-open', heading: t('library.empty'), text: t('library.empty.hint') }));
      }
      async function fetchFrom(url) {
        s.error = ''; s.busy = true; renderCenter();
        try {
          const lib = await library.load(url);
          const same = s.libraries.findIndex((x) => x.source === lib.source && lib.source);
          if (same >= 0) s.libraries[same] = lib; else s.libraries.push(lib);
          s.at = s.libraries.indexOf(lib);
          s.selected = null;
          shell.log(t('library.loaded', { name: lib.name, n: D.require('ui/i18n').formatNumber(lib.entries.length) }), 'ok');
        } catch (err) { s.error = String((err && err.message) || err); }
        s.busy = false;
        renderCenter(); renderInspector();
      }
      function renderCenter() {
        if (!slots) return;
        const librarySel = /** @type {any} */ (h('dm-select', { 'aria-label': t('library.source'), inline: true }));
        librarySel.options = s.libraries.map((lib, i) => ({ value: String(i), label: lib.source ? `${lib.name} (${D.require('platform/consent').hostOf(lib.source)})` : lib.name }));
        librarySel.value = String(s.at);
        librarySel.addEventListener('change', () => { s.at = Number(librarySel.value); s.selected = null; renderList(); renderInspector(); });
        const kindSel = /** @type {any} */ (h('dm-select', { 'aria-label': t('library.kind'), inline: true }));
        kindSel.options = [{ value: '', label: t('library.kind.all') }].concat(library.KINDS.map((k) => ({ value: k, label: t(`library.kind.${k}`) })));
        kindSel.value = s.kind;
        kindSel.addEventListener('change', () => { s.kind = kindSel.value; renderList(); });
        const search = /** @type {any} */ (h('dm-input', { type: 'search', placeholder: t('library.search'), 'aria-label': t('common.search'), inline: true }));
        search.value = s.search;
        search.addEventListener('input', () => { s.search = search.value.trim(); renderList(); });
        const urlIn = /** @type {any} */ (h('dm-input', { label: t('library.url'), help: t('library.url.help'), placeholder: library.HOME }));
        urlIn.value = s.url;
        urlIn.addEventListener('input', () => { s.url = urlIn.value.trim(); });
        listEl = h('div', { 'data-library-list': '' });
        replace(slots.center,
          h('div', { class: 'dm-page-head' },
            h('h1', null, ui.icon('book-open', 20), t('library.title')),
            h('div', { class: 'dm-toolbar' }, s.libraries.length > 1 ? librarySel : null, kindSel, search,
              ui.button({ label: t('library.own.save'), icon: 'download', title: t('library.own.save.hint'), onClick: saveOwn }))),
          h('p', { class: 'dm-help', text: t('library.help') }),
          listEl,
          h('section', { class: 'dm-stack-sm dm-card' },
            h('h3', { text: t('library.more') }),
            urlIn,
            h('div', { class: 'dm-row-wrap' },
              ui.button({ label: t('library.fetch'), icon: 'download', loading: s.busy, title: t('library.fetch.hint'), onClick: () => fetchFrom(s.url || library.HOME) })),
            s.error ? h('p', { class: 'dm-error dm-small', 'data-library-error': '', text: s.error }) : null));
        renderList();
      }
      async function addEntry(entry) {
        const lib = current();
        try {
          let datasetId;
          if (entry.kind === 'recipe') {
            const target = /** @type {any} */ (h('dm-select', { label: t('library.recipe.target') }));
            const tables = store.get().datasets;
            target.options = tables.map((d) => ({ value: d.id, label: d.name }));
            if (!tables.length) { ui.toast.show(t('library.err.dataset'), { kind: 'warn' }); return; }
            target.value = tables[0].id;
            const ok = await ui.dialog.open({
              title: entry.name, size: 'md',
              body: h('div', { class: 'dm-stack' }, target, h('pre', { class: 'dm-doc-help-pre', text: library.preview(entry) }), lib && lib.source ? h('p', { class: 'dm-warn', text: t('library.foreign', { host: D.require('platform/consent').hostOf(lib.source) }) }) : null),
              actions: [{ label: t('common.cancel'), value: false }, { label: t('library.recipe.run'), variant: 'primary', value: true, primary: true }],
            });
            if (ok !== true) return;
            datasetId = target.value;
          } else if (lib && lib.source) {
            const ok = await ui.dialog.confirm(t('library.foreign', { host: D.require('platform/consent').hostOf(lib.source) }), { okLabel: t('library.add') });
            if (!ok) return;
          }
          await library.add(entry, { datasetId });
          ui.toast.show(t('library.added', { name: entry.name }), { kind: 'ok' });
          shell.log(t('library.added', { name: entry.name }), 'ok');
        } catch (err) { fail(err); }
      }
      function renderInspector() {
        if (!slots) return;
        const e = s.selected;
        if (!e) { replace(slots.right, h('p', { class: 'dm-help', text: t('library.pick') })); return; }
        const lib = current();
        const kv = /** @type {any} */ (h('dm-kv'));
        kv.items = [
          { label: t('common.type'), value: t(`library.kind.${e.kind}`) },
          { label: t('library.license'), value: e.license },
          e.author ? { label: t('library.author'), value: e.author } : null,
          { label: t('library.source'), value: lib && lib.source ? lib.source : t('library.bundled') },
        ].filter(Boolean);
        replace(slots.right,
          h('h4', { text: e.name }),
          e.description ? h('p', { class: 'dm-help', text: e.description }) : null,
          kv,
          h('h4', { text: t('library.content') }),
          h('pre', { class: 'dm-doc-help-pre', 'data-library-preview': '', text: library.preview(e) }),
          h('div', { class: 'dm-row-wrap' }, ui.button({ label: e.kind === 'recipe' ? t('library.recipe.run') : t('library.add'), icon: e.kind === 'recipe' ? 'play' : 'download', variant: 'primary', onClick: () => addEntry(e) })));
      }
      async function saveOwn() {
        try {
          const items = await library.own();
          if (!items.length) { ui.toast.show(t('library.own.none'), { kind: 'info', timeout: 8000 }); return; }
          const chosen = new Set(items);
          const switches = items.map((item) => {
            const sw = /** @type {any} */ (h('dm-switch', { label: `${item.name} (${t(`library.kind.${item.kind}`)})`, checked: '' }));
            sw.addEventListener('change', () => { if (sw.checked) chosen.add(item); else chosen.delete(item); });
            return sw;
          });
          const nameIn = /** @type {any} */ (h('dm-input', { label: t('library.own.title') }));
          nameIn.value = t('library.own.name');
          const license = /** @type {any} */ (h('dm-select', { label: t('library.license') }));
          license.options = library.LICENSES.map((l) => ({ value: l, label: l }));
          license.value = library.LICENSES[0];
          const ok = await ui.dialog.open({
            title: t('library.own.save'), size: 'md',
            body: h('div', { class: 'dm-stack' }, h('p', { class: 'dm-help', text: t('library.own.help') }), nameIn, license, h('div', { class: 'dm-stack-sm' }, switches)),
            actions: [{ label: t('common.cancel'), value: false }, { label: t('library.own.save'), variant: 'primary', value: true, primary: true }],
          });
          if (ok !== true || !chosen.size) return;
          const author = await D.require('data/comments').author();
          services.files.download(new Blob([library.toFile(Array.from(chosen), { name: nameIn.value.trim(), license: license.value, author })], { type: 'application/json' }), services.files.safeName(nameIn.value.trim() || 'bibliotek', 'json'));
        } catch (err) { fail(err); }
      }
      async function render(target) {
        slots = target;
        try {
          if (!s.libraries.length) s.libraries.push(await library.bundled());
        } catch (err) { s.error = String((err && err.message) || err); }
        if (!slots) return;
        renderCenter(); renderInspector();
      }
      function destroy() { slots = null; listEl = null; }

      return { render, destroy, state: s };
    }

    return { create };
  });
})();
