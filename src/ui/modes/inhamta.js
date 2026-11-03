// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Mode "Inhämta": import wizard for files and pasted text (steps: file, options with preview, columns,
 * done) and open APIs (connector presets and imported configurations, see src/ui/api/api-view.js).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/modes/inhamta', ['ui/base', 'io/importers/csv', 'data/encoding', 'data/types', 'api/connectors', 'ui/api/api-view', 'platform/files'], (base, csv, encoding, types, connectors, apiView, files) => {
    const { h, t, i18n, replace } = base;
    const STEPS = [{ id: 'file', label: t('import.step.file') }, { id: 'options', label: t('import.step.options') }, { id: 'columns', label: t('import.step.columns') }, { id: 'done', label: t('import.step.done') }];
    const DECIMALS = [{ value: 'auto', label: 'Automatiskt' }, { value: 'comma', label: t('import.decimal.comma') }, { value: 'point', label: t('import.decimal.point') }];
    const FORMATS = ['csv', 'fixed', 'excel', 'json', 'xml', 'sqlite', 'shapefile', 'r'];
    /** Formats without a header-row switch (structure carries the names). */
    const NO_HEADER = ['json', 'xml', 'sqlite', 'shapefile', 'r'];
    /** Formats whose values are already typed (no decimal-separator choice). */
    const TYPED = ['sqlite', 'shapefile', 'r'];
    const ACCEPT = '.csv,.tsv,.txt,.tab,.dat,.fwf,.prn,.xlsx,.xlsm,.xls,.xlsb,.ods,.json,.ndjson,.jsonl,.geojson,.xml,.sqlite,.sqlite3,.db,.gpkg,.shp,.zip,.sav,.zsav,.por,.dta,.sas7bdat,.xpt,.px,.rds,.rda,.RData,.parquet';

    function createMode(ctx) {
      const { ui, services, store, shell } = ctx;
      let slots = null;
      let source = 'file';
      const wiz = reset();
      let previewTimer = 0;
      let connectorList = [];
      let unsubConnectors = null;
      /** @type {any} */ let apiUi = null;
      let apiId = null;

      function reset() { return { step: 'file', file: null, text: '', url: '', options: { format: '', encoding: '', delimiter: 'auto', header: undefined, sheet: '', path: '', decimal: 'auto', recordTag: '', table: '', layer: '', simplify: 0, breaks: '' }, preview: null, specs: [], name: '', busy: false, result: null, error: '' }; }
      function restart() { Object.assign(wiz, reset()); render(); }

      function activate(s) {
        slots = s;
        unsubConnectors = connectors.subscribe(reloadConnectors);
        reloadConnectors();
        render();
      }
      function deactivate() {
        slots = null;
        if (unsubConnectors) unsubConnectors();
        if (apiUi) { apiUi.destroy(); apiUi = null; apiId = null; }
      }
      async function reloadConnectors() {
        connectorList = await connectors.list();
        if (slots) renderLeft();
      }

      function render() {
        if (!slots) return;
        renderLeft(); renderCenter(); renderRight();
      }

      // ---- left: sources ----
      function renderLeft() {
        replace(slots.left,
          h('h4', { text: t('import.sources') }),
          h('div', { class: 'dm-list' },
            sourceItem('file', 'folder-open', t('import.sources.files'), null),
            sourceItem('paste', 'clipboard-paste', t('import.sources.paste'), t('import.sources.paste.hint')),
            sourceItem('url', 'link', t('import.sources.url'), t('import.sources.url.hint'))),
          h('h4', { text: t('api.sources') }),
          h('div', { class: 'dm-list' }, connectorList.map((c) => sourceItem('api:' + c.id, 'globe', c.name, [c.publisher, c.level === 2 ? t('api.level2') : ''].filter(Boolean).join(' · ')))),
          h('div', { class: 'dm-row' }, ui.button({ label: t('api.add.file'), icon: 'upload', size: 'sm', onClick: addConnector })),
          h('p', { class: 'dm-help dm-xs', text: t('import.sources.api.hint') }));
      }
      function sourceItem(id, icon, label, sub) {
        return h('button', { type: 'button', class: 'dm-list-item', 'aria-current': source === id ? 'true' : null, onclick: () => { source = id; if (!id.startsWith('api:') && wiz.step !== 'file') restart(); else render(); } },
          ui.icon(icon, 16), h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: label }), sub ? h('span', { class: 'dm-list-sub dm-truncate', text: sub }) : null));
      }
      async function addConnector() {
        const [file] = await files.pick({ accept: '.json,application/json' });
        if (!file) return;
        try {
          const c = await connectors.importJson(await file.text());
          shell.log(t('api.added', { name: c.name }), 'ok');
          ui.toast.show(t('api.added', { name: c.name }), { kind: 'ok' });
          await reloadConnectors();
          source = 'api:' + c.id;
          render();
        } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error', timeout: 12000 }); }
      }

      // ---- centre ----
      function renderCenter() {
        if (source.startsWith('api:')) { renderApi(); return; }
        const stepper = /** @type {any} */ (h('dm-stepper'));
        stepper.steps = STEPS; stepper.active = wiz.step;
        const body = wiz.step === 'file' ? stepFile() : wiz.step === 'options' ? stepOptions() : wiz.step === 'columns' ? stepColumns() : stepDone();
        replace(slots.center, h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon('download', 20), t('import.title')), stepper), body);
      }

      function renderApi() {
        const id = source.slice(4);
        const connector = connectorList.find((c) => c.id === id);
        if (!connector) { replace(slots.center, h('p', { class: 'dm-help', text: t('common.loading') })); return; }
        if (!apiUi || apiId !== id) {
          if (apiUi) apiUi.destroy();
          apiId = id;
          apiUi = apiView.create(ctx, connector, {
            onDataset: () => {},
            onRemoved: () => { apiUi = null; apiId = null; source = 'file'; reloadConnectors().then(render); },
          });
          apiUi.start();
        }
        replace(slots.center, apiUi.el);
      }

      /** Fetch a web address: configurations are added directly, data files continue in the wizard. */
      async function fetchUrl(url) {
        wiz.url = url; wiz.busy = true; wiz.error = ''; render();
        try {
          const urlImport = D.require('io/url-import');
          const file = await urlImport.fetchFile(url);
          if (/\.json$/i.test(file.name) || /json/.test(file.type)) {
            const text = await file.text();
            if (urlImport.configFormat(text)) {
              const res = await urlImport.importConfig(text);
              const msg = t('import.url.config.done', { kind: t('import.url.kind.' + res.kind), name: res.record && res.record.name ? res.record.name : file.name });
              shell.log(msg, 'ok'); ui.toast.show(msg, { kind: 'ok' });
              if (res.kind === 'api') await reloadConnectors();
              wiz.busy = false; render();
              return;
            }
          }
          wiz.file = file; wiz.text = ''; wiz.options.format = ''; wiz.options.sheet = ''; wiz.options.recordTag = ''; wiz.options.table = ''; wiz.options.header = undefined;
          wiz.busy = false;
          await runPreview();
          return;
        } catch (err) {
          wiz.error = (err && err.message) || String(err);
          shell.log(t('import.error', { message: wiz.error }), 'error');
        }
        wiz.busy = false; render();
      }

      function stepFile() {
        if (source === 'url') {
          const input = /** @type {any} */ (h('dm-input', { type: 'url', label: t('import.url.label'), placeholder: 'https://', value: wiz.url || '' }));
          input.addEventListener('keydown', (e) => { if (/** @type {any} */ (e).key === 'Enter') fetchUrl(input.value.trim()); });
          return h('div', { class: 'dm-stack' }, input,
            h('div', { class: 'dm-row' }, ui.button({ label: t('import.url.fetch'), variant: 'primary', icon: 'download', loading: wiz.busy, onClick: () => fetchUrl(input.value.trim()) })),
            wiz.error ? h('p', { class: 'dm-error dm-small', text: wiz.error }) : null,
            h('p', { class: 'dm-help', text: t('import.url.help') }));
        }
        if (source === 'paste') {
          const ta = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '12', label: t('import.paste.label'), mono: true }));
          ta.value = wiz.text;
          return h('div', { class: 'dm-stack' }, ta, h('div', { class: 'dm-row' }, ui.button({ label: t('import.paste.use'), variant: 'primary', icon: 'check', onClick: async () => { wiz.text = ta.value; if (!wiz.text.trim()) return; wiz.file = null; await runPreview(); } })));
        }
        const dz = h('dm-dropzone', { text: t('import.drop'), hint: t('import.drop.hint'), accept: ACCEPT });
        dz.addEventListener('dm-files', async (e) => { wiz.file = /** @type {any} */ (e).detail.files[0]; wiz.text = ''; wiz.options.format = ''; wiz.options.sheet = ''; wiz.options.recordTag = ''; wiz.options.table = ''; wiz.options.header = undefined; await runPreview(); });
        // Bundled data: the example table first, then the SCB boundaries for maps.
        const examples = D.require('presets').examples;
        return h('div', { class: 'dm-stack' }, dz,
          h('div', { class: 'dm-row-wrap' }, examples.map((p, i) => ui.button({ label: i === 0 ? t('presets.try') : p.name, icon: p.format === 'geojson' ? 'globe' : 'sparkles', onClick: () => importPreset(p) }))),
          h('span', { class: 'dm-help', text: t('presets.geo.hint') }));
      }

      async function importPreset(preset) {
        wiz.busy = true; render();
        try {
          const meta = await services.importer.runPreset(preset);
          wiz.result = meta; wiz.step = 'done'; wiz.name = meta.name;
          shell.log(t('presets.done', { name: meta.name }), 'ok');
        } catch (err) {
          wiz.error = (err && err.message) || String(err);
          shell.log(t('import.error', { message: wiz.error }), 'error');
        }
        wiz.busy = false; render();
      }

      async function runPreview() {
        wiz.busy = true; wiz.error = ''; render();
        try {
          const opts = cleanOptions();
          wiz.preview = wiz.file ? await services.importer.preview(wiz.file, opts) : await services.importer.previewText(wiz.text, opts);
          wiz.options.format = wiz.preview.importer;
          if (wiz.preview.encoding && !wiz.options.encoding) wiz.options.encoding = wiz.preview.encoding;
          if (wiz.preview.sheet !== undefined) wiz.options.sheet = wiz.preview.sheet;
          if (wiz.options.header === undefined) wiz.options.header = wiz.preview.header;
          wiz.specs = wiz.preview.inferred.map((c) => Object.assign({}, c));
          if (!wiz.name) wiz.name = wiz.file ? services.importer.baseName(wiz.file.name) : 'Inklistrad tabell';
          wiz.step = wiz.step === 'file' ? 'options' : wiz.step;
        } catch (err) {
          wiz.error = (err && err.message) || String(err);
          shell.log(t('import.error', { message: wiz.error }), 'error');
        }
        wiz.busy = false; render();
      }

      function cleanOptions() {
        const o = Object.assign({}, wiz.options);
        if (!o.format) delete o.format;
        if (!o.encoding) delete o.encoding;
        if (!o.sheet) delete o.sheet;
        if (!o.path) delete o.path;
        if (!o.recordTag) delete o.recordTag;
        if (!o.table) delete o.table;
        if (!o.layer) delete o.layer;
        if (!o.simplify) delete o.simplify;
        if (!o.breaks) delete o.breaks;
        if (o.decimal === 'auto') delete o.decimal;
        return o;
      }

      function schedulePreview() { clearTimeout(previewTimer); previewTimer = setTimeout(() => runPreview(), 250); }

      function stepOptions() {
        const p = wiz.preview;
        const left = h('div', { class: 'dm-stack' });
        if (wiz.file) left.appendChild(h('p', { class: 'dm-help', text: t('import.file', { name: wiz.file.name, size: i18n.formatBytes(wiz.file.size) }) }));
        const format = select(t('import.format'), FORMATS.map((f) => ({ value: f, label: t('import.format.' + f) })), wiz.options.format, (v) => { wiz.options.format = v; wiz.options.header = undefined; wiz.options.recordTag = ''; wiz.options.table = ''; schedulePreview(); });
        if (wiz.file) left.appendChild(format);
        if (wiz.options.format === 'csv' || wiz.options.format === 'fixed') {
          const encOptions = encoding.ENCODINGS.map((e) => ({ value: e.value, label: e.label + (p && p.encodingDetected && p.encodingDetected.encoding === e.value ? ' (identifierad)' : '') }));
          if (wiz.file) left.appendChild(select(t('import.encoding'), encOptions, wiz.options.encoding || 'utf-8', (v) => { wiz.options.encoding = v; schedulePreview(); }));
          if (wiz.options.format === 'csv') left.appendChild(select(t('import.delimiter'), csv.DELIMITERS.map((d) => ({ value: d.value, label: d.value === 'auto' ? 'Automatiskt' + (p && p.delimiter ? ` (${describeDelimiter(p.delimiter)})` : '') : t(d.key) })), wiz.options.delimiter, (v) => { wiz.options.delimiter = v; schedulePreview(); }));
          else {
            const breaks = /** @type {any} */ (h('dm-input', { label: t('import.breaks'), help: t('import.breaks.help'), placeholder: p && p.breaksText ? p.breaksText : '0, 12, 20' }));
            breaks.value = wiz.options.breaks || '';
            breaks.addEventListener('change', () => { wiz.options.breaks = breaks.value; schedulePreview(); });
            left.appendChild(breaks);
          }
        }
        if (wiz.options.format === 'excel' && p && p.sheets) {
          left.appendChild(select(t('import.sheet'), p.sheets.map((s) => ({ value: s, label: s })), wiz.options.sheet || p.sheet, (v) => { wiz.options.sheet = v; wiz.options.header = undefined; schedulePreview(); }));
        }
        if (wiz.options.format === 'json') {
          const path = /** @type {any} */ (h('dm-input', { label: t('import.jsonpath'), placeholder: p && p.pathSuggestions && p.pathSuggestions.length ? p.pathSuggestions.join(', ') : 'data.items', value: wiz.options.path }));
          path.addEventListener('change', () => { wiz.options.path = path.value; schedulePreview(); });
          left.appendChild(path);
        }
        if (wiz.options.format === 'json' && p && p.jsonStat) left.appendChild(h('p', { class: 'dm-help dm-small', text: t('import.jsonstat') }));
        if (wiz.options.format === 'xml' && p && p.pathSuggestions && p.pathSuggestions.length) {
          left.appendChild(select(t('import.recordtag'), p.pathSuggestions.map((s) => ({ value: s, label: s })), wiz.options.recordTag || p.recordTag, (v) => { wiz.options.recordTag = v; schedulePreview(); }));
        }
        if (wiz.options.format === 'sqlite' && p) {
          if (p.dataspatium) left.appendChild(h('p', { class: 'dm-help dm-small', text: t('import.sqlite.dataspatium') }));
          else if (p.tables && p.tables.length) left.appendChild(select(t('import.table'), p.tables.map((s) => ({ value: s, label: s })), wiz.options.table || p.table, (v) => { wiz.options.table = v; schedulePreview(); }));
        }
        if (wiz.options.format === 'shapefile' && p) {
          if (p.layers && p.layers.length > 1) left.appendChild(select(t('import.layer'), p.layers.map((s) => ({ value: s, label: s })), wiz.options.layer || p.layer, (v) => { wiz.options.layer = v; schedulePreview(); }));
          const simp = /** @type {any} */ (h('dm-input', { type: 'number', label: t('import.simplify'), help: t('import.simplify.help'), min: '0' }));
          simp.value = String(wiz.options.simplify || 0);
          simp.addEventListener('change', () => { wiz.options.simplify = Number(simp.value) || 0; schedulePreview(); });
          left.appendChild(simp);
          left.appendChild(h('p', { class: 'dm-help dm-small', text: t('import.shapefile.info', { crs: p.crs || t('import.shapefile.crs.unknown'), points: i18n.formatNumber(p.points || 0) }) }));
        }
        const viaR = !!(p && p.viaR);
        if (viaR) left.appendChild(h('p', { class: 'dm-help', text: t('import.r.hint', { pkg: p.pkg, reader: p.reader }) }));
        if (!NO_HEADER.includes(wiz.options.format)) {
          const header = /** @type {any} */ (h('dm-switch', { label: t('import.header') }));
          header.checked = !!wiz.options.header;
          header.addEventListener('change', () => { wiz.options.header = header.checked; schedulePreview(); });
          left.appendChild(header);
        }
        if (!TYPED.includes(wiz.options.format)) left.appendChild(select(t('import.decimal'), DECIMALS, wiz.options.decimal, (v) => { wiz.options.decimal = v; schedulePreview(); }));
        if (viaR) {
          // No column step: R reads the file and dm_write() sets the types, so only the name is asked for here.
          const name = /** @type {any} */ (h('dm-input', { label: t('import.name'), value: wiz.name }));
          name.addEventListener('input', () => { wiz.name = name.value; });
          left.appendChild(name);
          if (wiz.busy) left.appendChild(h('dm-progress', { indeterminate: true, label: t('import.r.running') }));
        }
        if (wiz.error) left.appendChild(h('p', { class: 'dm-error dm-small', text: wiz.error }));
        left.appendChild(h('div', { class: 'dm-row' },
          ui.button({ label: t('common.back'), icon: 'chevron-left', disabled: wiz.busy, onClick: restart }),
          viaR ? ui.button({ label: t('common.import'), icon: 'check', variant: 'primary', loading: wiz.busy, onClick: runImport })
            : ui.button({ label: t('common.next'), icon: 'chevron-right', variant: 'primary', disabled: !p || !p.columns.length || wiz.busy, onClick: () => { wiz.step = 'columns'; render(); } })));
        const right = h('div', { class: 'dm-table-wrap' },
          h('h3', { text: t('import.preview', { n: p ? p.dataRows.length : 0 }) }),
          p && p.columns.length ? previewTable(p) : h('p', { class: 'dm-help', text: wiz.busy ? t('common.loading') : viaR ? t('import.r.nopreview') : t('import.no.rows') }));
        return h('div', { class: 'dm-two-col' }, left, right);
      }

      function describeDelimiter(d) { return d === ';' ? t('import.delimiter.semicolon') : d === ',' ? t('import.delimiter.comma') : d === '\t' ? t('import.delimiter.tab') : d === '|' ? t('import.delimiter.pipe') : JSON.stringify(d); }

      function previewTable(p) {
        const table = /** @type {any} */ (h('dm-table', { style: { minHeight: '320px' } }));
        const rows = p.dataRows.map((r) => r.map((v) => (v instanceof Date ? types.parseDateTime(v) : v)));
        requestAnimationFrame(() => table.setData({
          columns: p.columns.map((name, i) => ({ key: name, label: name, type: p.inferred && p.inferred[i] ? p.inferred[i].type : 'text' })),
          rowCount: rows.length,
          rowProvider: async (start, count) => rows.slice(start, start + count),
        }));
        return table;
      }

      function select(label, options, value, onChange) {
        const el = /** @type {any} */ (h('dm-select', { label }));
        el.options = options; el.value = value;
        el.addEventListener('change', () => onChange(el.value));
        return el;
      }

      function stepColumns() {
        const name = /** @type {any} */ (h('dm-input', { label: t('import.name'), value: wiz.name }));
        name.addEventListener('input', () => { wiz.name = name.value; });
        const rows = wiz.specs.map((spec, i) => {
          const include = /** @type {any} */ (h('dm-switch', { label: '' }));
          include.checked = spec.include !== false;
          include.addEventListener('change', () => { spec.include = include.checked; });
          const nameIn = /** @type {any} */ (h('dm-input', { value: spec.name, 'aria-label': t('common.name') }));
          nameIn.addEventListener('change', () => { spec.name = nameIn.value.trim() || spec.name; spec.label = spec.name; });
          const typeSel = select('', types.TYPES.map((ty) => ({ value: ty, label: t('type.' + ty) })), spec.type, (v) => { spec.type = v; });
          typeSel.setAttribute('aria-label', t('common.type'));
          const sample = (wiz.preview.dataRows.slice(0, 3).map((r) => r[i]).filter((v) => v !== null && v !== undefined && String(v) !== '').map(String).join(', ')).slice(0, 60);
          return h('tr', null, h('td', null, include), h('td', null, nameIn), h('td', null, typeSel), h('td', { class: 'dm-muted dm-small', text: sample }), h('td', { class: 'dm-faint dm-xs', text: spec.reason === 'leading-zero' ? 'inledande nollor' : '' }));
        });
        const importBtn = ui.button({ label: t('common.import'), icon: 'check', variant: 'primary', loading: wiz.busy, onClick: runImport });
        return h('div', { class: 'dm-stack' },
          h('div', { class: 'dm-form-grid' }, name),
          h('p', { class: 'dm-help', text: t('import.columns.help') }),
          h('table', { class: 'dm-columns-table' }, h('thead', null, h('tr', null, h('th', { text: t('import.column.include') }), h('th', { text: t('common.name') }), h('th', { text: t('common.type') }), h('th', { text: 'Exempel' }), h('th'))), h('tbody', null, rows)),
          wiz.busy ? h('dm-progress', { indeterminate: true, label: wiz.progress ? t('import.progress', { rows: i18n.formatNumber(wiz.progress.rows) }) : t('import.running') }) : null,
          wiz.error ? h('p', { class: 'dm-error dm-small', text: wiz.error }) : null,
          h('div', { class: 'dm-row' }, ui.button({ label: t('common.back'), icon: 'chevron-left', disabled: wiz.busy, onClick: () => { wiz.step = 'options'; render(); } }), importBtn));
      }

      async function runImport() {
        if (wiz.busy) return;
        wiz.busy = true; wiz.error = ''; wiz.progress = null; render();
        const t0 = performance.now();
        try {
          const opts = cleanOptions();
          const specs = wiz.specs.map((s) => ({ name: s.name, type: s.type, include: s.include !== false, decimal: s.decimal, label: s.label || s.name }));
          // Large delimited files are streamed; the progress callback shows the rows read so far.
          const onProgress = (p) => { wiz.progress = p; render(); };
          const meta = wiz.file ? await services.importer.run(wiz.file, opts, specs, wiz.name, onProgress) : await services.importer.runText(wiz.text, opts, specs, wiz.name);
          wiz.result = meta; wiz.step = 'done';
          shell.log(t('import.done', { name: meta.name, rows: i18n.formatNumber(meta.rowCount), cols: meta.columnCount }) + ` (${Math.round(performance.now() - t0)} ms)`, 'ok');
          ui.toast.show(t('import.done', { name: meta.name, rows: i18n.formatNumber(meta.rowCount), cols: meta.columnCount }), { kind: 'ok' });
        } catch (err) {
          wiz.error = (err && err.message) || String(err);
          shell.log(t('import.error', { message: wiz.error }), 'error');
        }
        wiz.busy = false; render();
      }

      function stepDone() {
        const m = wiz.result;
        return h('div', { class: 'dm-success' },
          h('h2', null, ui.icon('circle-check', 20), ' ', t('import.done', { name: m.name, rows: i18n.formatNumber(m.rowCount), cols: m.columnCount })),
          h('div', { class: 'dm-row' },
            ui.button({ label: t('import.open.bearbeta'), variant: 'primary', icon: 'pencil', onClick: () => { store.set({ selectedId: m.id }); shell.activate('bearbeta'); } }),
            ui.button({ label: t('import.another'), icon: 'plus', onClick: restart })));
      }

      // ---- right ----
      function renderRight() {
        if (source.startsWith('api:')) { if (apiUi) apiUi.renderRight(slots.right); else replace(slots.right); return; }
        const items = [];
        if (wiz.file) {
          items.push(h('h4', { text: t('import.step.file') }));
          const kv = /** @type {any} */ (h('dm-kv'));
          kv.items = [
            { label: t('common.name'), value: wiz.file.name },
            { label: t('common.size'), value: i18n.formatBytes(wiz.file.size) },
            { label: t('common.type'), value: wiz.file.type || wiz.file.name.split('.').pop() },
            { label: t('common.updated'), value: wiz.file.lastModified ? i18n.formatDateTime(new Date(wiz.file.lastModified)) : '' },
          ];
          items.push(kv);
        }
        if (wiz.preview) {
          items.push(h('h4', { text: t('import.step.options') }));
          const kv2 = /** @type {any} */ (h('dm-kv'));
          const p = wiz.preview;
          kv2.items = [
            { label: t('import.format'), value: p.importer },
            p.reader ? { label: t('import.r.reader'), value: `${p.reader} (${p.pkg})` } : null,
            p.encoding ? { label: t('import.encoding'), value: p.encoding + (p.encodingDetected ? ` (${p.encodingDetected.confidence})` : '') } : null,
            p.delimiter ? { label: t('import.delimiter'), value: describeDelimiter(p.delimiter) } : null,
            { label: t('datasets.columns'), value: String(p.columns.length) },
            p.totalRows !== undefined ? { label: t('datasets.rows'), value: i18n.formatNumber(p.totalRows) } : null,
          ].filter(Boolean);
          items.push(kv2);
        }
        if (!items.length) items.push(h('p', { class: 'dm-help', text: t('mode.inhamta.desc') }));
        replace(slots.right, items);
      }

      return { id: 'inhamta', activate, deactivate };
    }
    return { createMode };
  });
})();
