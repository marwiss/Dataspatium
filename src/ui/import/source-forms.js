// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Three sources of Inhämta that need no group of their own: Exempeldata (the bundled examples, F128 a), Gränser för kartor (the
 * bundled boundaries) and API från fil (a configuration file of a source). The examples and the boundaries are the posts of
 * presets/presets.js, an example without `boundary` and a boundary with it, so that a new example (PLAN 12 f) is one more post
 * there. Each shows where it comes from and its licence.
 *
 * Gränser för kartor and API från fil are forms built once and shown in one of two places (F126 a): in Inhämta's workspace
 * (`form`), or as a dialog (`open`) when another mode or a card opens them.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/import/source-forms', ['ui/base', 'ui/basic', 'ui/overlays', 'presets', 'api/connectors', 'data/kinds'], (base, basic, overlays, presets, connectors, kinds) => {
    const { h, t, i18n, replace } = base;
    /** The bundled examples and boundaries, in the order of presets/presets.js; a set of boundaries with `example` is both. */
    const examples = () => presets.examples.filter((p) => !p.boundary || p.example);
    const boundaries = () => presets.examples.filter((p) => p.boundary);
    const nameOf = (p) => (p.nameKey ? t(p.nameKey) : p.name);
    const descriptionOf = (p) => (p.descriptionKey ? t(p.descriptionKey) : p.description || '');
    const fail = (ctx, err) => { const m = String((err && err.message) || err); if (ctx.shell) ctx.shell.log(t('import.error', { message: m }), 'error'); overlays.toast.show(m, { kind: 'error', timeout: 12000 }); };

    /** Where a bundled dataset comes from, under which licence and with which credit and changes, with a link to the source. */
    function provenance(p) {
      const s = p.source || {};
      const parts = [s.publisher ? `${t('examples.source')}: ${s.publisher}` : '', s.license ? `${t('api.license')}: ${s.license}` : ''].filter(Boolean);
      return h('div', { class: 'dm-stack-sm' },
        h('p', { class: 'dm-help dm-small', 'data-provenance': '' }, parts.join(' · '),
          s.url && /^https:\/\//.test(s.url) ? [' · ', h('a', { href: s.url, target: '_blank', rel: 'noopener', text: t('examples.link') })] : null),
        s.attribution ? h('p', { class: 'dm-help dm-small', 'data-attribution': '', text: `${t('examples.attribution')}: ${s.attributionKey ? t(s.attributionKey) : s.attribution}` }) : null);
    }
    /** The dataset the workspace has from a bundled post, the newest first, or null. @param {any} ctx @param {any} p */
    function importedOf(ctx, p) {
      const hits = ctx.store.get().datasets.filter((d) => d.source && d.source.preset === p.id);
      return hits.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;
    }
    /** The way on from an imported dataset: its own view, or the table in Bearbeta. @param {any} ctx @param {any} m */
    function openButton(ctx, m, extra) {
      const own = kinds.shown(m) ? kinds.of(m).open : null;
      return basic.button(Object.assign({ label: own ? t(own.label) : t('import.open.bearbeta'), icon: own ? own.icon : 'pencil', onClick: () => { ctx.store.set({ selectedId: m.id }); ctx.shell.activate('bearbeta'); } }, extra || {}));
    }
    async function importPost(ctx, p) {
      const meta = await ctx.services.importer.runPreset(p);
      ctx.shell.log(t('presets.done', { name: meta.name }), 'ok');
      return meta;
    }

    /**
     * Exempeldata: each example with what it is, where it comes from and its licence, Importera per example and Importera alla.
     * @param {any} ctx the mode context
     */
    function examplesView(ctx) {
      const busy = new Set();
      let target = null;
      async function run(list) {
        const key = list.length > 1 ? '*' : list[0].id;
        if (busy.size) return;
        busy.add(key); draw();
        try {
          for (const p of list) await importPost(ctx, p);
          const text = list.length > 1 ? t('examples.done.all', { n: list.length }) : t('presets.done', { name: nameOf(list[0]) });
          overlays.toast.show(text, { kind: 'ok' });
        } catch (err) { fail(ctx, err); }
        busy.delete(key); draw();
      }
      function card(p, i) {
        const have = importedOf(ctx, p);
        return h('div', { class: 'dm-card dm-stack-sm', 'data-example': p.id },
          h('div', { class: 'dm-row' }, h('h3', { class: 'dm-grow', text: nameOf(p) }), have ? h('dm-badge', { kind: 'ok', text: t('examples.imported') }) : null),
          h('p', { text: descriptionOf(p) }),
          provenance(p),
          h('div', { class: 'dm-row-wrap' },
            basic.button({ label: t('common.import'), icon: 'download', loading: busy.has(p.id), disabled: busy.size > 0 && !busy.has(p.id), title: t('examples.import.hint'), 'data-example-import': p.id, 'data-course': i === 0 ? 'example' : null, onClick: () => run([p]) }),
            have ? openButton(ctx, have, { 'data-example-open': p.id }) : null));
      }
      function draw() {
        if (!target) return;
        const list = examples();
        replace(target,
          h('div', { class: 'dm-page-head' }, h('h1', null, ctx.ui.icon('sparkles', 20), t('examples.title')),
            list.length ? basic.button({ label: t('examples.import.all', { n: list.length }), icon: 'download', variant: 'primary', loading: busy.has('*'), disabled: busy.size > 0 && !busy.has('*'), title: t('examples.import.all.hint'), 'data-examples-all': '', onClick: () => run(list) }) : null),
          h('p', { class: 'dm-help', text: t('examples.lead') }),
          h('div', { class: 'dm-stack', 'data-examples': '' }, list.map(card)));
      }
      return {
        /** @param {HTMLElement} el */
        render(el) { target = el; draw(); },
        /** @param {HTMLElement} right */
        renderRight(right) { replace(right, h('h4', { text: t('examples.title') }), h('p', { class: 'dm-help', text: t('examples.right') })); },
        destroy() { target = null; },
      };
    }

    /**
     * A form built once, shown in the workspace or as a dialog. `build(ctx, options, finish)` returns its element and calls
     * `finish(value)` with what it made.
     * @param {(ctx: any, options: any, finish: (value: any) => void) => HTMLElement} build
     * @param {string} titleKey @param {string} help the handbook's section for the dialog
     */
    function twoPlaces(build, titleKey, help) {
      return {
        /** In the workspace: `done` resolves with the first value the form makes. @param {any} ctx @param {any} [options] */
        form(ctx, options) {
          /** @type {(v: any) => void} */ let settle = () => {};
          const done = new Promise((resolve) => { settle = resolve; });
          return { el: build(ctx, options || {}, (v) => settle(v)), done, title: t(titleKey) };
        },
        /** As a dialog: resolves with what the form made, or null. @param {any} ctx @param {any} [options] */
        open(ctx, options) {
          return overlays.dialog.open({ title: t(titleKey), help, body: (finish) => build(ctx, options || {}, finish), actions: [{ label: t('common.cancel'), value: null }] })
            .then((v) => (v && typeof v === 'object' ? v : null));
        },
      };
    }

    /** Gränser för kartor: choose a set of boundaries, see where it comes from, and import it. */
    const boundariesForm = twoPlaces((ctx, _options, finish) => {
      const list = boundaries();
      const state = { id: list[0] ? list[0].id : '', busy: false, done: /** @type {any} */ (null) };
      const body = h('div', { class: 'dm-stack', 'data-boundaries': '' });
      function draw() {
        const p = list.find((x) => x.id === state.id) || list[0];
        const pick = /** @type {any} */ (h('dm-select', { label: t('presets.geo.label'), 'data-boundaries-pick': '' }));
        pick.options = list.map((x) => ({ value: x.id, label: nameOf(x) }));
        pick.value = p.id;
        pick.addEventListener('change', () => { state.id = pick.value; state.done = null; draw(); });
        const go = async () => {
          if (state.busy) return;
          state.busy = true; state.done = null; draw();
          try {
            state.done = await importPost(ctx, p);
            overlays.toast.show(t('presets.done', { name: state.done.name }), { kind: 'ok' });
          } catch (err) { fail(ctx, err); }
          state.busy = false; draw();
          if (state.done) finish(state.done);
        };
        replace(body, pick,
          h('div', { class: 'dm-card dm-stack-sm', 'data-boundary': p.id }, h('p', { text: descriptionOf(p) }), provenance(p)),
          h('div', { class: 'dm-row' }, basic.button({ label: t('presets.geo.import'), icon: 'download', variant: 'primary', loading: state.busy, 'data-boundaries-import': '', onClick: go })),
          state.done ? h('div', { class: 'dm-success dm-stack-sm', 'data-boundaries-done': '' },
            h('p', { text: t('import.done', { name: state.done.name, rows: i18n.formatNumber(state.done.rowCount || 0), cols: state.done.columnCount || 0 }) }),
            h('div', { class: 'dm-row' }, openButton(ctx, state.done))) : null);
      }
      if (list.length) draw();
      return body;
    }, 'presets.geo.label', 'kallor#gränser-för-kartor');

    /** API från fil: a configuration of a source (dataspatium-api/1) dropped or chosen, added as a source of the user's own. */
    const apiFileForm = twoPlaces((ctx, _options, finish) => {
      const state = { busy: false, error: '' };
      const body = h('div', { class: 'dm-stack', 'data-api-file': '' });
      const zone = h('dm-dropzone', { text: t('apifile.drop'), hint: t('apifile.drop.hint'), accept: '.json,application/json', icon: 'file-json' });
      zone.addEventListener('dm-files', (e) => { const file = (/** @type {any} */ (e).detail.files || [])[0]; if (file) read(file); });
      async function read(file) {
        if (state.busy) return;
        state.busy = true; state.error = ''; draw();
        try {
          const c = await connectors.importJson(await file.text());
          ctx.shell.log(t('api.added', { name: c.name }), 'ok');
          overlays.toast.show(t('api.added', { name: c.name }), { kind: 'ok' });
          state.busy = false; draw();
          finish(c);
        } catch (err) { state.busy = false; state.error = (err && err.message) || String(err); draw(); }
      }
      function draw() {
        replace(body, zone,
          state.busy ? h('dm-progress', { indeterminate: true, label: t('common.loading') }) : null,
          state.error ? h('p', { class: 'dm-error dm-small', 'data-api-file-error': '', text: state.error }) : null,
          h('p', { class: 'dm-help', text: t('import.sources.api.hint') }));
      }
      draw();
      return body;
    }, 'api.add.file.short', 'api-konfiguration');

    return { examples, boundaries, examplesView, boundariesForm, apiFileForm, provenance };
  });
})();
