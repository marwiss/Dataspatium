// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Presentation mode for dashboards: the dashboard fills the window (full screen when the browser allows it) with
 * an overview of all charts and one step per chart; the shared filters stay in the bar. Arrow keys, space and
 * Page Up/Down step, Home shows the overview, F toggles full screen and Escape leaves. Nothing is saved here;
 * the dashboard itself stays as it is.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/viz/present', ['ui/base', 'ui/basic', 'viz/render', 'viz/dashboards', 'viz/data'], (base, basic, render, dashboards, vizData) => {
    const { h, t, replace } = base;
    /** The open presentation, if any (one at a time). */
    let current = null;
    const GAP = 16; const PAD = 12; const HEAD = 36;

    /** Whether the page may go full screen (not without a user gesture, not in every embedding). */
    function fullscreenAllowed() { return !!(document.fullscreenEnabled && document.documentElement.requestFullscreen); }

    /**
     * Open the presentation of a dashboard (one at a time; a new one replaces the open one).
     * @param {any} dashboard a dashboard record (viz/dashboards)
     * @param {{log?: (message: string, kind?: string) => void, step?: number}} [options]
     * @returns {Promise<{el: HTMLElement, state: {step: number, values: Record<string, any>, fullscreen: boolean}, steps: () => Array<{label: string}>, next: () => void, prev: () => void, goto: (i: number) => void, setFilter: (column: string, value: any) => void, toggleFullscreen: () => Promise<void>, onKey: (e: KeyboardEvent) => void, close: () => void, rendered: () => number}>}
     */
    async function open(dashboard, options = {}) {
      if (current) current.close();
      const dash = JSON.parse(JSON.stringify(dashboard));
      const log = options.log || ((m, k) => D.log('present', k || 'info', m));
      const resolved = await dashboards.resolveCharts(dash);
      const shared = await dashboards.sharedColumns(dash);
      const state = { step: Math.max(0, Math.min(resolved.length, Number(options.step) || 0)), values: {}, fullscreen: false };
      const handles = [];
      /** @type {Record<string, any>} column -> its select in the bar */
      const selects = {};
      let renderSeq = 0; let resizeTimer = 0; let closed = false;
      const previousFocus = /** @type {HTMLElement|null} */ (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      const stage = h('div', { class: 'dm-present-stage' });
      const stepEl = h('span', { class: 'dm-present-step', 'aria-live': 'polite' });
      const filterBar = h('div', { class: 'dm-row-wrap dm-present-filters' });
      const fsSlot = h('span', { class: 'dm-present-fs' });
      const el = h('section', { class: 'dm-present', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('present.title.of', { name: dash.name || t('dash.title') }), tabindex: '-1' },
        h('header', { class: 'dm-present-bar' },
          h('div', { class: 'dm-present-titles' }, h('strong', { class: 'dm-truncate', text: dash.name || t('dash.title') }), stepEl),
          filterBar,
          h('div', { class: 'dm-row' },
            basic.button({ label: t('present.prev'), icon: 'chevron-left', 'icon-only': true, variant: 'ghost', onClick: () => prev() }),
            basic.button({ label: t('present.overview'), icon: 'layout-grid', 'icon-only': true, variant: 'ghost', onClick: () => goto(0) }),
            basic.button({ label: t('present.next'), icon: 'chevron-right', 'icon-only': true, variant: 'ghost', onClick: () => next() }),
            fsSlot,
            basic.button({ label: t('present.close'), icon: 'x', 'icon-only': true, variant: 'ghost', title: t('present.keys'), onClick: () => close() }))),
        stage);

      const count = () => resolved.length;
      const steps = () => [{ label: t('present.overview') }].concat(resolved.map(({ chart }) => ({ label: chart.name })));
      function finalizeAll() { for (const hd of handles) { try { hd.finalize(); } catch (_e) { /* ignore */ } } handles.length = 0; }

      /** The full-screen button is rebuilt on every change so that its label follows the state. */
      function renderFsButton() {
        replace(fsSlot, fullscreenAllowed() ? basic.button({ label: state.fullscreen ? t('present.fullscreen.exit') : t('present.fullscreen'), icon: state.fullscreen ? 'grid-2x2' : 'square', 'icon-only': true, variant: 'ghost', onClick: () => toggleFullscreen() }) : null);
      }

      /** Charts of the current step, sized to the stage: the overview shares the height between its rows. */
      function renderStage() {
        finalizeAll();
        const seq = ++renderSeq;
        const extraFilters = dashboards.toExtraFilters(state.values);
        const total = count();
        stepEl.textContent = state.step === 0 ? t('present.step.overview', { n: total }) : t('present.step', { n: state.step, total, name: resolved[state.step - 1].chart.name });
        stage.classList.toggle('dm-present-single', state.step !== 0);
        if (!total) {
          stage.style.gridTemplateColumns = '';
          replace(stage, h('dm-empty-state', { icon: 'layout-grid', heading: dash.name || t('dash.title'), text: t('present.empty') }));
          return;
        }
        const shown = state.step === 0 ? resolved : [resolved[state.step - 1]];
        const cols = state.step === 0 ? Math.max(1, Math.min(3, Number(dash.columns) || 2)) : 1;
        const span = (item) => Math.min(item.span || 1, cols);
        const rows = Math.max(1, Math.ceil(shown.reduce((s, { item }) => s + span(item), 0) / cols));
        stage.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
        const colW = Math.floor(((stage.clientWidth || 1200) - 2 * GAP - GAP * (cols - 1)) / cols);
        const rowH = Math.floor(((stage.clientHeight || 700) - 2 * GAP - GAP * (rows - 1)) / rows);
        const height = Math.max(160, rowH - 2 * PAD - HEAD - 2);
        replace(stage, shown.map(({ item, chart }) => {
          const width = Math.max(240, colW * span(item) + GAP * (span(item) - 1) - 2 * PAD - 2);
          const holder = h('div', { class: 'dm-chart-preview dm-present-chart' });
          const card = h('article', { class: 'dm-present-card', style: { gridColumn: `span ${span(item)}` } }, h('h2', { class: 'dm-truncate', text: chart.name }), holder);
          if (chart.kind === 'python' && chart.python && chart.python.plotly) { D.require('viz/plotly').render(holder, chart.python.plotly, { width, height }).then((hd) => { if (seq === renderSeq) handles.push(hd); else hd.finalize(); }).catch((err) => replace(holder, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) }))); }
          else if (D.require('viz/code-charts').isCode(chart.kind)) replace(holder, chart.thumbnail ? h('img', { class: 'dm-gallery-thumb', src: chart.thumbnail, alt: chart.name }) : h('p', { class: 'dm-help', text: t('dash.code.note') }));
          else render.renderInto(chart, holder, { extraFilters, width, height }).then((hd) => { if (seq === renderSeq) handles.push(hd); else hd.finalize(); }).catch((err) => replace(holder, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) })));
          return card;
        }));
      }

      /** One select per shared filter column, like the dashboard's own filter bar. */
      async function renderFilters() {
        const items = [];
        const dsId = resolved.length ? resolved[0].chart.datasetId : null;
        for (const f of dash.filters || []) {
          const col = shared.find((c) => c.name === f.column);
          if (!col) continue;
          const sel = /** @type {any} */ (h('dm-select', { label: col.label || col.name, inline: true }));
          let opts = [];
          if (dsId) { try { opts = await vizData.distinctValues(dsId, f.column, 500); } catch (_err) { opts = []; } }
          sel.options = [{ value: '', label: t('dash.filter.all') }].concat(opts.map((v) => ({ value: String(v), label: String(v) })));
          sel.value = '';
          sel.addEventListener('change', () => { state.values[f.column] = sel.value === '' ? '' : vizData.coerce(sel.value, col.type); renderStage(); });
          selects[f.column] = sel;
          items.push(sel);
        }
        replace(filterBar, items);
        filterBar.hidden = !items.length;
      }

      function goto(i) { if (closed) return; state.step = Math.max(0, Math.min(count(), Number(i) || 0)); renderStage(); }
      function next() { goto(state.step >= count() ? 0 : state.step + 1); }
      function prev() { goto(state.step <= 0 ? count() : state.step - 1); }
      function setFilter(column, value) {
        state.values[column] = value;
        if (selects[column]) selects[column].value = value === undefined || value === null ? '' : String(value);
        renderStage();
      }

      async function toggleFullscreen() {
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else if (fullscreenAllowed()) await el.requestFullscreen();
        } catch (err) { log(String((err && err.message) || err), 'warn'); }
      }
      function onFullscreenChange() {
        state.fullscreen = document.fullscreenElement === el;
        renderFsButton();
        renderStage();
      }
      function onResize() { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderStage, 150); }

      /** Keys while presenting (fields keep their own keys). */
      function onKey(e) {
        if (closed || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
        const tag = e.target && /** @type {HTMLElement} */ (e.target).tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        switch (e.key) {
          case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': next(); break;
          case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': prev(); break;
          case 'Home': goto(0); break;
          case 'End': goto(count()); break;
          case 'f': case 'F': toggleFullscreen(); break;
          case 'Escape': if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); } else close(); break;
          default: return;
        }
        e.preventDefault();
        e.stopPropagation();
      }

      function close() {
        if (closed) return;
        closed = true;
        clearTimeout(resizeTimer);
        finalizeAll();
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('fullscreenchange', onFullscreenChange);
        window.removeEventListener('resize', onResize);
        if (document.fullscreenElement === el) document.exitFullscreen().catch(() => {});
        el.remove();
        document.body.classList.remove('dm-presenting');
        if (current === ctl) current = null;
        if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
      }

      const ctl = { el, state, steps, next, prev, goto, setFilter, toggleFullscreen, onKey, close, rendered: () => handles.length, get dashboard() { return dash; } };
      current = ctl;
      document.body.appendChild(el);
      document.body.classList.add('dm-presenting');
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('fullscreenchange', onFullscreenChange);
      window.addEventListener('resize', onResize);
      renderFsButton();
      await renderFilters();
      renderStage();
      el.focus();
      return ctl;
    }

    return { open, current: () => current, fullscreenAllowed };
  });
})();
