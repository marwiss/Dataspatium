// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * R charts in Visualisera: an R script with the dataset preloaded as `df`, run in the R session;
 * the last plot is shown and can be exported through R (svglite, png, pdf). Batch runs re-run the
 * script with `df` filtered per group.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/viz/r-panel', ['ui/base', 'ui/basic', 'data/r-bridge'], (base, basic, rb) => {
    const { h, t, i18n, replace } = base;
    const bridge = rb.bridge;

    function template(datasetName, columns) {
      const num = columns.find((c) => c.type === 'integer' || c.type === 'number');
      const cat = columns.find((c) => c.type === 'text');
      const x = cat ? cat.name : (columns[0] ? columns[0].name : 'x'); const y = num ? num.name : (columns[1] ? columns[1].name : 'y');
      return `library(ggplot2)\nlibrary(dplyr)\n\n${D.t('r.snippet.comment', { name: datasetName })}\ndf |>\n  group_by(${x}) |>\n  summarise(${y} = sum(${y}, na.rm = TRUE)) |>\n  slice_max(${y}, n = 15) |>\n  ggplot(aes(x = reorder(${x}, ${y}), y = ${y})) +\n  geom_col(fill = dm_palette()[1]) +\n  coord_flip() +\n  labs(title = "${datasetName}", x = NULL, y = "${y}") +\n  theme_dataspatium()\n`;
    }

    /** Code that loads the dataset (by short name when known, optionally filtered) before the user's script. */
    function prelude(datasetRef, group) {
      const lines = [`df <- dm_read(${JSON.stringify(datasetRef)})`];
      if (group) lines.push(`df <- df[!is.na(df[[${JSON.stringify(group.column)}]]) & as.character(df[[${JSON.stringify(group.column)}]]) == ${JSON.stringify(String(group.value))}, , drop = FALSE]`);
      return lines.join('\n') + '\n';
    }

    /**
     * @param {{chart: any, columns: any[], onChange: (code: string) => void, log: Function}} options
     */
    function create(options) {
      const { chart } = options;
      const el = h('div', { class: 'dm-stack' });
      const preview = h('div', { class: 'dm-chart-preview dm-r-preview' }, h('p', { class: 'dm-help', text: t('viz.r.help') }));
      const output = h('pre', { class: 'dm-console-stdout dm-viz-r-output' });
      let plotKey = null; let plotCanvas = null; let running = false;
      const editor = /** @type {any} */ (h('dm-code', { language: 'r', placeholder: t('viz.r.placeholder') }));
      editor.value = (chart.r && chart.r.code) || template(chart.datasetName, options.columns);
      if (!(chart.r && chart.r.code)) options.onChange(editor.value);
      editor.addEventListener('dm-change', () => options.onChange(editor.value));
      editor.addEventListener('dm-run', () => run());
      const status = h('dm-badge', { text: '' });
      const runBtn = basic.button({ label: t('viz.r.run'), icon: 'play', variant: 'primary', onClick: () => run() });
      const unsub = bridge.on((type) => { if (type === 'state') updateStatus(); });
      function updateStatus() {
        const map = { idle: 'analysera.status.idle', starting: 'analysera.status.starting', ready: 'analysera.status.ready', busy: 'analysera.status.busy', error: 'analysera.status.error' };
        status.textContent = t(map[bridge.state] || map.idle);
        runBtn.disabled = running || bridge.state === 'starting';
      }
      async function run(group) {
        if (running) return null;
        running = true; updateStatus(); runBtn.loading = true;
        try {
          const res = await bridge.run(prelude(chart.datasetShort || chart.datasetName, group) + editor.value);
          const plots = res.entries.filter((e) => e.kind === 'plot');
          const texts = res.entries.filter((e) => e.kind === 'stdout' || e.kind === 'stderr' || e.kind === 'error').map((e) => e.text).join('\n');
          output.textContent = texts.slice(0, 4000);
          output.hidden = !texts;
          if (plots.length) {
            const last = plots[plots.length - 1];
            plotKey = last.key; plotCanvas = last.canvas;
            last.canvas.classList.add('dm-console-plot');
            replace(preview, last.canvas);
          } else if (!group) {
            replace(preview, h('p', { class: 'dm-help', text: t('viz.r.no.plot') }));
          }
          const errors = res.entries.filter((e) => e.kind === 'error');
          if (errors.length) options.log('R: ' + errors[0].text, 'error');
          return plotKey;
        } catch (err) { options.log('R: ' + ((err && err.message) || err), 'error'); replace(preview, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) })); return null; }
        finally { running = false; runBtn.loading = false; updateStatus(); }
      }
      /** Export the current plot, or re-run for a group first (batch). */
      async function exportBlob(format, opts = {}) {
        let key = plotKey;
        if (opts.group) key = await run(opts.group);
        if (key === null || key === undefined) throw new Error(t('viz.r.no.plot'));
        const width = (Number(opts.width) || 960) / 96; const height = (Number(opts.height) || Math.round((Number(opts.width) || 960) * 0.6)) / 96;
        return bridge.exportPlot(key, format, { width: width.toFixed(2), height: height.toFixed(2), dpi: 150 });
      }
      async function thumbnail() {
        if (!plotCanvas) return null;
        try { const c = document.createElement('canvas'); c.width = 480; c.height = Math.round(480 * plotCanvas.height / plotCanvas.width); c.getContext('2d').drawImage(plotCanvas, 0, 0, c.width, c.height); return c.toDataURL('image/png'); } catch (_e) { return null; }
      }
      replace(el,
        h('div', { class: 'dm-row' }, runBtn, status, h('span', { class: 'dm-help', text: t('analysera.run.hint') })),
        h('div', { class: 'dm-editor-wrap' }, editor),
        output,
        preview);
      output.hidden = true;
      updateStatus();
      bridge.start().catch((err) => options.log('R: ' + ((err && err.message) || err), 'error'));
      return { el, run, exportBlob, thumbnail, destroy: unsub, get code() { return editor.value; }, formatNumber: i18n.formatNumber };
    }
    return { create, template, prelude };
  });
})();
