// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Grundkurs: an interactive beginner's course through the six modes with the bundled example dataset
 * (population per municipality 2024). It runs in a floating, non-modal panel so that the user works in the
 * real app: each step explains a concept and gives a task, notices when the task is done and can do it for
 * the user. The course opens at the first start (empty workspace), is offered once to existing users and can
 * be reopened from the help dialog or the command palette. Progress is kept in localStorage.
 * `index.html?course=off` turns the automatic start off (screenshots); `?course=on` opens the course.
 *
 * Modes cooperate through the store: `pendingCode` ({lang, code, run}) is taken by Analysera, `openChartId`
 * by Visualisera, and Analysera and Exportera report `lastRun` ({lang, at, ok}) and `lastExport` ({at}).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/course', ['ui/base', 'ui/basic', 'ui/overlays', 'ui/icons', 'data/datasets', 'data/recipes', 'io/import', 'viz/charts', 'viz/vega-builder', 'presets'],
    (base, basic, overlays, icons, datasets, recipes, importer, charts, builder, presets) => {
      const { h, t, i18n } = base;
      const KEY = 'dataspatium.course';
      const EXAMPLE = 'befolkning-kommuner-2024';
      const EXPRESSION = 'round(folkmangd / 1000.0, 1)';
      const MODES = ['inhamta', 'hantera', 'soka', 'bearbeta', 'analysera', 'visualisera', 'exportera', 'dela'];
      /** The word the search step looks for in the example data. */
      const QUERY = 'Stockholm';
      const CHECK_MS = 1000;

      /**
       * The steps in order. `mode` is where the task is done, `target` the control to click once there and
       * `action` what the course button does: 'doit' performs the task, 'show' only goes to the right place.
       */
      const STEPS = [
        { id: 'welcome' },
        { id: 'import', mode: 'inhamta', target: '[data-course="example"]', action: 'doit' },
        { id: 'manage', mode: 'hantera', action: 'show' },
        { id: 'search', mode: 'soka', target: '[data-course="search"]', action: 'doit' },
        { id: 'process', mode: 'bearbeta', target: '[data-course="actions"]', action: 'doit' },
        { id: 'sql', mode: 'analysera', action: 'doit' },
        { id: 'r', mode: 'analysera', action: 'doit' },
        { id: 'viz', mode: 'visualisera', target: '[data-course="new-chart"]', action: 'doit' },
        { id: 'export', mode: 'exportera', target: '[data-course="export"]', action: 'show' },
        { id: 'share', mode: 'dela', action: 'show' },
        { id: 'finish' },
      ];

      /** Saved progress: {status: 'open'|'closed'|'done'|'offered', step}. */
      function load() {
        try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && typeof s === 'object' ? s : null; } catch (_e) { return null; }
      }
      function persist(state) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_e) { /* storage may be unavailable */ } }

      /** The newest dataset imported from the bundled example, or null. */
      async function findExample() {
        const hits = (await datasets.list()).filter((d) => d.source && d.source.preset === EXAMPLE);
        hits.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        return hits[0] || null;
      }

      /**
       * Paragraph content from a dictionary text: each {placeholder} becomes a strong label (`{strong: text}`),
       * code (`{code: text}`) or plain text.
       * @param {string} key
       * @param {Record<string, any>} [params]
       * @returns {Array<Node|string>}
       */
      function rich(key, params = {}) {
        const raw = t(key);
        const out = [];
        let last = 0;
        for (const m of raw.matchAll(/\{(\w+)\}/g)) {
          out.push(raw.slice(last, m.index));
          const v = params[m[1]];
          if (v && typeof v === 'object' && 'strong' in v) out.push(h('strong', { text: v.strong }));
          else if (v && typeof v === 'object' && 'code' in v) out.push(h('code', { text: v.code }));
          else out.push(v === undefined ? m[0] : String(v));
          last = /** @type {number} */ (m.index) + m[0].length;
        }
        out.push(raw.slice(last));
        return out.filter((x) => x !== '');
      }

      /**
       * Course controller for an application shell (one per app).
       * @param {any} shell the shell: store, activate(mode), log(message, kind) and toast(message, options)
       */
      function create(shell) {
        /** @type {ReturnType<typeof overlays.floating>|null} */
        let panel = null;
        let index = 0; let enteredAt = 0; let timer = 0; let checking = false; let finished = false;
        /** Steps whose task was seen done while the course has been open. */
        let done = new Set();
        let example = null;

        const strong = (text) => ({ strong: text });
        const code = (text) => ({ code: text });
        const mode = (id) => strong(t('mode.' + id));
        const shortName = () => (example && example.shortName) || 'befolkning_2024';
        const column = () => t('course.process.column');
        const sqlCode = () => `select lan, sum(folkmangd) as folkmangd\nfrom ${shortName()}\ngroup by lan\norder by folkmangd desc`;
        const rCode = () => `df <- dm_read("${shortName()}")\nsummary(df$folkmangd)\nlibrary(ggplot2)\nggplot(df, aes(folkmangd)) +\n  geom_histogram(bins = 30) +\n  scale_x_log10() +\n  theme_dataspatium()`;

        // React at once when the user switches mode, runs code or exports, instead of at the next poll.
        shell.store.subscribe((state, changed) => { if (panel && (changed.includes('mode') || changed.includes('lastRun') || changed.includes('lastExport') || changed.includes('lastSearch'))) tick(); });

        /** Texts of a step: paragraphs, the task (with code to type) and the line shown when it is done. */
        function content(step) {
          const p = (key, params) => rich('course.' + step.id + '.' + key, params);
          switch (step.id) {
            case 'welcome': return { paragraphs: [p('p1'), p('p2', { example: strong(t('preset.befolkning.name')), modes: MODES.map((m) => t('mode.' + m)).join(' → ') }), p('p3')] };
            case 'import': return { paragraphs: [p('p1')], task: p('task', { mode: mode('inhamta'), button: strong(t('presets.try')), name: strong(t('preset.befolkning.name')) }), done: p('done', { short: code(shortName()) }) };
            case 'manage': return { paragraphs: [p('p1', { mode: mode('hantera'), short: code(shortName()) }), p('p2', { backup: strong(t('datasets.backup')) })], task: p('task', { mode: mode('hantera') }), done: p('done') };
            case 'search': return { paragraphs: [p('p1', { mode: mode('soka') })], task: p('task', { mode: mode('soka'), query: code(QUERY), run: strong(t('soka.run')) }), done: p('done', { save: strong(t('soka.save.list')), lists: strong(t('soka.tabs.listor')) }) };
            case 'share': return { paragraphs: [p('p1', { mode: mode('dela') })], task: p('task', { mode: mode('dela') }), done: p('done', { bundle: strong(t('bundle.create')), receive: strong(t('dela.tabs.receive')) }) };
            case 'process': return {
              paragraphs: [p('p1', { mode: mode('bearbeta') }), p('p2', { recipe: strong(t('bearbeta.recipe')) })],
              task: p('task', { mode: mode('bearbeta'), actions: strong(t('bearbeta.actions')), group: strong(t('op.group.structure')), op: strong(t('op.add_column')), column: code(column()), expression: code(EXPRESSION) }),
              done: p('done', { column: code(column()) }),
            };
            case 'sql': return { paragraphs: [p('p1', { mode: mode('analysera'), data: code('data') })], task: p('task', { mode: mode('analysera'), tab: strong(t('analysera.tabs.sql')), run: strong(t('sql.run')) }), code: sqlCode(), done: p('done', { save: strong(t('sql.save.dataset')) }) };
            case 'r': return { paragraphs: [p('p1', { read: code('dm_read()'), write: code('dm_write()') })], task: p('task', { mode: mode('analysera'), tab: strong(t('analysera.tabs.r')), run: strong(t('analysera.run')) }), code: rCode(), done: p('done') };
            case 'viz': return {
              paragraphs: [p('p1')],
              task: p('task', { mode: mode('visualisera'), new: strong(t('viz.new')), builder: strong(t('viz.kind.vega')), type: strong(t('viz.charttype.barh')), x: strong(t('viz.channel.x')), y: strong(t('viz.channel.y')), save: strong(t('viz.save')) }),
              done: p('done', { map: strong(t('viz.charttype.map')), boundaries: strong(t('preset.kommuner.name')) }),
            };
            case 'export': return { paragraphs: [p('p1', { mode: mode('exportera') })], task: p('task', { mode: mode('exportera'), run: strong(t('export.run')) }), done: p('done', { charts: strong(t('doc.tab.charts')), documents: strong(t('doc.tab.documents')) }) };
            case 'finish': return { paragraphs: [p('p1'), p('p2', { import: mode('inhamta'), analyse: mode('analysera'), export: mode('exportera'), palette: strong('Ctrl+K') }), p('p3', { help: strong(t('shell.help')) })] };
            default: return { paragraphs: [] };
          }
        }

        function render() {
          if (!panel) return;
          const step = STEPS[index];
          const c = content(step);
          const body = [h('dm-progress', { value: String(Math.round((100 * index) / (STEPS.length - 1))), label: t('course.progress') })];
          for (const para of c.paragraphs) body.push(h('p', null, para));
          if (c.task) {
            const isDone = done.has(step.id);
            body.push(h('div', { class: 'dm-course-task', 'data-done': isDone },
              h('h4', { text: t('course.task') }),
              h('p', null, c.task),
              c.code ? h('pre', { class: 'dm-course-code' }, h('code', { text: c.code })) : null,
              isDone && c.done ? h('p', { class: 'dm-course-done', role: 'status' }, icons.icon('circle-check', 16), h('span', null, c.done)) : null));
          }
          if (step.id === 'finish') body.push(h('p', null, h('a', { href: i18n.docsUrl(), target: '_blank', rel: 'noopener', text: t('shell.help.docs.link') })));
          panel.update({ title: t('course.' + step.id + '.title'), meta: t('course.title') + ' · ' + t('course.step', { n: index + 1, total: STEPS.length }), body, actions: actions(step) });
        }

        function actions(step) {
          if (step.id === 'welcome') {
            return [
              basic.button({ label: t('course.later'), variant: 'ghost', onClick: () => close() }),
              basic.button({ label: t('course.start'), icon: 'graduation-cap', variant: 'primary', onClick: () => go(index + 1) }),
            ];
          }
          const back = basic.button({ label: t('common.back'), variant: 'ghost', onClick: () => go(index - 1) });
          if (step.id === 'finish') return [back, basic.button({ label: t('course.finish'), icon: 'circle-check', variant: 'primary', onClick: () => finish() })];
          const act = basic.button({
            label: t(step.action === 'doit' ? 'course.doit' : 'course.show'), icon: step.action === 'doit' ? 'wand-sparkles' : 'eye',
            onClick: async () => {
              act.loading = true;
              try { await perform(step.id); } catch (err) { shell.log(String((err && err.message) || err), 'error'); }
              act.loading = false;
              tick();
            },
          });
          return [back, act, basic.button({ label: t('common.next'), variant: 'primary', onClick: () => go(index + 1) })];
        }

        /** Show step `i` and remember it. */
        function go(i) {
          index = Math.max(0, Math.min(STEPS.length - 1, i));
          enteredAt = Date.now();
          persist({ status: 'open', step: index });
          render();
          tick();
        }

        /**
         * Open the course at step `at`, by default where the user left off (or at the start after finishing).
         * @param {number} [at]
         */
        function open(at) {
          const saved = load();
          const resume = saved && saved.status !== 'done' && Number.isInteger(saved.step) ? saved.step : 0;
          if (!panel) {
            panel = overlays.floating({
              collapseLabel: t('course.collapse'), expandLabel: t('course.expand'),
              onClose: () => {
                panel = null; stop(); clearTargets();
                persist(finished ? { status: 'done', step: 0 } : { status: 'closed', step: index });
                if (finished) done = new Set();
                finished = false;
              },
            });
          }
          panel.collapse(false);
          go(typeof at === 'number' ? at : resume);
          panel.focus();
          stop();
          timer = setInterval(tick, CHECK_MS);
        }
        function close() { if (panel) panel.close(); }
        function finish() { finished = true; close(); }
        function stop() { if (timer) clearInterval(timer); timer = 0; }

        /** Make sure the example dataset exists and is selected; returns its catalogue record. */
        async function ensureExample() {
          let ex = await findExample();
          if (!ex) {
            ex = await importer.runPreset(presets.examples.find((p) => p.id === EXAMPLE));
            shell.log(t('presets.done', { name: ex.name }), 'ok');
          }
          example = ex;
          // The shell reloads its dataset list after an import; the modes look the selection up in that list.
          const id = ex.id;
          for (let i = 0; i < 100 && !shell.store.get().datasets.some((d) => d.id === id); i++) await new Promise((r) => setTimeout(r, 50));
          shell.store.set({ selectedId: ex.id });
          return ex;
        }

        /** The bar chart of the course: population per county, largest first. */
        function countyChart(ex, columns) {
          const state = builder.defaultState('barh', columns);
          const lan = columns.find((c) => c.name === 'lan');
          const pop = columns.find((c) => c.name === 'folkmangd');
          if (lan) state.x = builder.channel(lan, { sort: '-y' });
          if (pop) state.y = builder.channel(pop, { aggregate: 'sum' });
          state.title = t('course.viz.chart');
          const record = charts.create('vega', ex, t('course.viz.chart'));
          record.vega = { type: 'barh', state, customSpec: null };
          return record;
        }

        /**
         * Do the task of a step for the user (or, for 'show' steps, go to the right place).
         * @param {string} id step id
         */
        async function perform(id) {
          const ex = await ensureExample();
          if (id === 'import') return;
          let handOver = null;
          if (id === 'process') {
            const columns = await datasets.columns(ex.id);
            if (!columns.some((c) => c.name === column())) await recipes.apply(ex.id, 'add_column', { name: column(), expression: EXPRESSION });
          } else if (id === 'sql' || id === 'r') {
            handOver = { pendingCode: { lang: id, code: id === 'sql' ? sqlCode() : rCode(), run: true } };
          } else if (id === 'viz') {
            const mine = (await charts.list(ex.id)).find((c) => c.name === t('course.viz.chart'));
            const chart = mine || await charts.save(countyChart(ex, await datasets.columns(ex.id)));
            handOver = { openChartId: chart.id };
          } else if (id === 'search') {
            handOver = { selectedId: ex.id, pendingSearch: { text: QUERY, at: Date.now() } };
          }
          // Go to the step's mode unless already there (activating rebuilds the mode), then hand over code or a chart.
          const step = STEPS.find((s) => s.id === id);
          if (step && step.mode && shell.store.get().mode !== step.mode) shell.activate(step.mode);
          if (handOver) shell.store.set(handOver);
        }

        /** Whether the task of a step is done (in its current state, or since the step was shown). */
        async function check(step) {
          const state = shell.store.get();
          switch (step.id) {
            case 'import': return !!example;
            case 'manage': return state.mode === 'hantera';
            case 'share': return state.mode === 'dela';
            case 'search': return !!state.lastSearch && state.lastSearch.at >= enteredAt;
            case 'process': return !!example && (await datasets.columns(example.id)).some((c) => c.name === column());
            case 'sql': case 'r': return !!state.lastRun && state.lastRun.lang === step.id && state.lastRun.ok !== false && state.lastRun.at >= enteredAt;
            case 'viz': return !!example && (await charts.list(example.id)).some((c) => c.name === t('course.viz.chart') || Date.parse(c.updatedAt || '') >= enteredAt);
            case 'export': return !!state.lastExport && state.lastExport.at >= enteredAt;
            default: return false;
          }
        }

        /** Mark the control to click next: the mode button until the user is in the right mode, then the target. */
        function highlight() {
          const step = STEPS[index];
          const current = shell.store.get().mode;
          let selector = '';
          if (panel && !panel.collapsed() && step.mode && !done.has(step.id)) selector = current !== step.mode ? `.dm-mode-btn[data-mode="${step.mode}"]` : (step.target || '');
          for (const el of Array.from(document.querySelectorAll('.dm-course-target'))) if (!selector || !el.matches(selector)) el.classList.remove('dm-course-target');
          if (selector) for (const el of Array.from(document.querySelectorAll(selector))) el.classList.add('dm-course-target');
        }
        function clearTargets() { for (const el of Array.from(document.querySelectorAll('.dm-course-target'))) el.classList.remove('dm-course-target'); }

        /** Poll: refresh the highlight and look for the current task being done. */
        async function tick() {
          if (!panel) return;
          highlight();
          const step = STEPS[index];
          if (checking || !step.mode || done.has(step.id)) return;
          checking = true;
          try {
            const before = example && example.shortName;
            example = await findExample();
            if (await check(step)) { done.add(step.id); render(); highlight(); }
            else if ((example && example.shortName) !== before) render();
          } catch (err) { D.log('course', 'check failed', err); }
          checking = false;
        }

        /**
         * Start of the app: open the course for a new user (empty workspace), resume an open course, or offer
         * it once to an existing user.
         */
        function autoStart() {
          const param = new URLSearchParams(location.search).get('course');
          if (param === 'off') { persist({ status: 'closed', step: 0 }); return; }
          if (param === 'on') { open(0); return; }
          const saved = load();
          if (saved && saved.status === 'open') { open(); return; }
          if (saved) return;
          if (!shell.store.get().datasets.length) { open(0); return; }
          persist({ status: 'offered', step: 0 });
          shell.toast(t('course.offer'), { kind: 'info', timeout: 15000, action: { label: t('course.start'), onClick: () => open(0) } });
        }

        return {
          open, close, finish, autoStart, perform, tick,
          next: () => go(index + 1),
          back: () => go(index - 1),
          get index() { return index; },
          get step() { return STEPS[index].id; },
          isOpen: () => !!panel,
          isDone: (id) => done.has(id),
          panel: () => panel,
        };
      }

      return { STEPS, KEY, EXAMPLE, create, load, findExample };
    });
})();
