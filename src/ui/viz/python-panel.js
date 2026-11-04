// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Python charts in Visualisera: a script with the dataset preloaded as `df` (pandas), run in the Python session;
 * the last figure (matplotlib or plotly) is shown and exported through the bridge. Batch runs re-run the script
 * with `df` filtered per group. Python starts on Start or Run, never by just opening the chart (it is fetched on
 * first use).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/viz/python-panel', ['ui/base', 'ui/basic', 'data/python-bridge', 'viz/code-charts'], (base, basic, pb, codeCharts) => {
    const { h, t, replace } = base;
    const bridge = pb.bridge;

    function template(datasetName, columns) {
      const num = columns.find((c) => c.type === 'integer' || c.type === 'number');
      const cat = columns.find((c) => c.type === 'text');
      const x = cat ? cat.name : (columns[0] ? columns[0].name : 'x'); const y = num ? num.name : (columns[1] ? columns[1].name : 'y');
      return `import matplotlib.pyplot as plt\n\n# ${t('python.snippet.comment', { name: datasetName })}\nper = df.groupby(${JSON.stringify(x)})[${JSON.stringify(y)}].sum().sort_values().tail(15)\nfig, ax = plt.subplots()\nax.barh(per.index.astype(str), per.values, color=dm_palette()[0])\nax.set_title(${JSON.stringify(datasetName)})\n`;
    }

    function blobToDataUrl(blob) {
      return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(blob); });
    }
    /** A 480 px wide PNG data URL from a base64 PNG (the thumbnail in lists and dashboards). */
    function shrink(pngBase64) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { try { const c = document.createElement('canvas'); c.width = 480; c.height = Math.round(480 * img.height / img.width); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); resolve(c.toDataURL('image/png')); } catch (_err) { resolve(null); } };
        img.onerror = () => resolve(null);
        img.src = 'data:image/png;base64,' + pngBase64;
      });
    }

    /**
     * @param {{chart: any, columns: any[], onChange: (code: string, plotly: any) => void, log: Function}} options
     */
    function create(options) {
      const { chart } = options;
      if (!chart.python) chart.python = { code: '', plotly: null };
      const el = h('div', { class: 'dm-stack' });
      const preview = h('div', { class: 'dm-chart-preview dm-r-preview' }, h('p', { class: 'dm-help', text: t('viz.python.help') }));
      const output = h('pre', { class: 'dm-console-stdout dm-viz-r-output' });
      let plotKey = null; let plotPng = null; let plotly = chart.python.plotly || null; let running = false; let handle = null;
      const editor = /** @type {any} */ (h('dm-code', { language: 'python', placeholder: t('viz.python.placeholder') }));
      editor.value = chart.python.code || template(chart.datasetName, options.columns);
      if (!chart.python.code) options.onChange(editor.value, plotly);
      editor.addEventListener('dm-change', () => options.onChange(editor.value, plotly));
      editor.addEventListener('dm-run', () => run());
      const status = h('dm-badge', { text: '' });
      const runBtn = basic.button({ label: t('viz.r.run'), icon: 'play', variant: 'primary', onClick: () => run() });
      const startBtn = basic.button({ label: t('python.start'), icon: 'download', title: t('python.start.hint'), onClick: () => bridge.start().catch((err) => options.log('Python: ' + ((err && err.message) || err), 'error')) });
      const unsub = bridge.on((type) => { if (type === 'state' || type === 'progress') updateStatus(); });
      function updateStatus() {
        const map = { idle: 'python.status.idle', starting: 'python.status.starting', ready: 'python.status.ready', busy: 'python.status.busy', error: 'python.status.error' };
        let label = t(map[bridge.state] || map.idle);
        if (bridge.state === 'starting' && bridge.progress && bridge.progress.total) label = t('python.status.downloading', { pct: Math.min(99, Math.round(100 * bridge.progress.received / bridge.progress.total)) });
        status.textContent = label;
        runBtn.disabled = running || bridge.state === 'starting';
        startBtn.hidden = !(bridge.state === 'idle' || bridge.state === 'error');
      }
      async function showPlot(last) {
        if (handle) { handle.finalize(); handle = null; }
        if (last.plotly) {
          const holder = h('div', { class: 'dm-plotly', style: { width: '100%', height: (last.height || 480) + 'px' } });
          replace(preview, holder);
          try { handle = await D.require('viz/plotly').render(holder, last.plotly); } catch (err) { replace(preview, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) })); }
        } else {
          const img = h('img', { class: 'dm-console-plot', alt: '' });
          img.src = last.svg ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(last.svg) : 'data:image/png;base64,' + (last.png || '');
          replace(preview, img);
        }
      }
      /** Run the script; `filters` (batch per group) filter df first. Returns the plot key or null. */
      async function run(filters) {
        if (running) return null;
        running = true; updateStatus(); runBtn.loading = true;
        try {
          const res = await bridge.run(codeCharts.prelude('python', chart.datasetShort || chart.datasetName, filters || []) + editor.value);
          const plots = res.entries.filter((e) => e.kind === 'plot' && e.key);
          const texts = res.entries.filter((e) => e.kind === 'stdout' || e.kind === 'stderr' || e.kind === 'error').map((e) => e.text).join('\n');
          output.textContent = texts.slice(0, 4000);
          output.hidden = !texts;
          if (plots.length) {
            const last = plots[plots.length - 1];
            plotKey = last.key; plotPng = last.png || null; plotly = last.plotly || null;
            await showPlot(last);
            options.onChange(editor.value, plotly);
          } else if (!filters) {
            replace(preview, h('p', { class: 'dm-help', text: t('viz.code.no.plot') }));
          }
          const errors = res.entries.filter((e) => e.kind === 'error');
          if (errors.length) options.log('Python: ' + errors[0].text, 'error');
          return plotKey;
        } catch (err) { options.log('Python: ' + ((err && err.message) || err), 'error'); replace(preview, h('p', { class: 'dm-error dm-small', text: String((err && err.message) || err) })); return null; }
        finally { running = false; runBtn.loading = false; updateStatus(); }
      }
      /** Export the current plot, or re-run for a group first (batch). Sizes in pixels become inches at 96 per inch. */
      async function exportBlob(format, opts = {}) {
        let key = plotKey;
        if (opts.group) key = await run([{ field: opts.group.column, op: '=', value: opts.group.value }]);
        if (key === null || key === undefined) throw new Error(t('viz.code.no.plot'));
        const width = (Number(opts.width) || 960) / 96; const height = (Number(opts.height) || Math.round((Number(opts.width) || 960) * 0.6)) / 96;
        return bridge.exportPlot(key, format, { width: width.toFixed(2), height: height.toFixed(2), dpi: 150 });
      }
      async function thumbnail() {
        try {
          if (plotly) return await blobToDataUrl(await D.require('viz/plotly').toBlob(plotly, 'png', { width: 480, height: 288, scale: 1 }));
          return plotPng ? await shrink(plotPng) : chart.thumbnail || null;
        } catch (_err) { return chart.thumbnail || null; }
      }
      replace(el,
        h('div', { class: 'dm-row' }, runBtn, startBtn, status, h('span', { class: 'dm-help', text: t('analysera.run.hint') })),
        h('div', { class: 'dm-editor-wrap' }, editor),
        output,
        preview);
      output.hidden = true;
      updateStatus();
      return { el, run, exportBlob, thumbnail, destroy: () => { unsub(); if (handle) handle.finalize(); }, get code() { return editor.value; }, get plotly() { return plotly; } };
    }
    return { create, template };
  });
})();
