// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The AI panel of a digital comprehensive plan in Bearbeta's plan view (B-78), in the inspector: the same providers, policy and
 * agent loop as the model's panel (ui/bearbeta/ai-panel, ai/agent), with the plan's own tools (ai/plan-tools) in three modes:
 * Fråga (the AI reads and answers, and the areas it rests on can be chosen on the map), Ändra and Bygg från beskrivning (the AI
 * fills a change set of data/plan-edit's edits; in the build mode it may ask the person). The change set is listed in words, with
 * the new and changed sections' texts, and Förhandsvisa tries it on a copy of the plan and draws its areas on the plan's map
 * (new green, changed yellow, removed red and dashed); Godkänn makes it one step of the plan's log with its provenance, undone at
 * once with the app's undo, and Avvisa drops it. Nothing reaches the plan before the approval, and removals are confirmed once
 * more. The model's panel is not reused as a whole: its preview runs the IFC wheel in Python and draws in 3D, and its approval
 * and proposals go through the model's own steps and Dataregium; here they are the plan's edits and its map. Texts reach the page
 * only as text.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/plan-ai', ['ui/base', 'ui/basic', 'ai/providers', 'ai/agent', 'ai/plan-tools', 'ui/bearbeta/ai-panel', 'data/plan-edit', 'data/plan-links', 'data/recipes', 'viz/theme', 'platform/storage/idb'],
    (base, basic, providers, agent, planTools, aiPanel, planEdit, planLinks, recipes, theme, idb) => {
      const { h, t, i18n, replace } = base;
      const MODES = ['ask', 'change', 'build'];
      const LAST_SETTING = 'ai.lastProvider';
      const WRITES = new Set(planTools.WRITE_TOOLS.map((x) => x.name));
      const str = (v) => (v === null || v === undefined ? '' : String(v));

      /**
       * @param {any} ctx shell context
       * @param {{datasetId: string, mode?: string, brief?: string, view?: () => any, sources?: () => any[], rows?: () => any[], map?: () => ({map: any, L: any}|null), pick?: (ids: string[]) => void, onApproved?: () => void}} options
       *   `view` what the person has chosen ({picked, marked, feature}), `sources` the other datasets on the map (ui/viz/map-overlays
       *   features), `rows` the plan's rows as the view read them, `map` its Leaflet map, `pick` chooses areas by objektid, `onApproved`
       *   draws the plan again
       */
      function create(ctx, options) {
        const { shell, ui } = ctx;
        const s = { providers: [], providerId: '', policy: 'ask', mode: MODES.includes(String(options.mode)) ? String(options.mode) : 'ask', question: options.brief ? String(options.brief) : '',
          busy: false, answer: '', steps: [], areas: [], usage: null, error: '', history: [], exchanges: [], changeset: planTools.create(options.datasetId),
          preview: /** @type {any} */ (null), previewing: false, approving: false, questionBox: /** @type {any} */ (null) };
        const el = h('div', { class: 'dm-card dm-stack-sm', 'data-plan-ai': '' });
        let abort = null; let layer = null;
        const log = (msg, kind) => { if (shell && shell.log) shell.log(msg, kind || 'ok'); };
        const fail = (err) => { s.error = String((err && err.message) || err); log(`AI: ${s.error}`, 'error'); };
        const changing = () => s.mode !== 'ask';
        const provider = () => s.providers.find((p) => p.id === s.providerId) || null;
        const unsubscribe = providers.subscribe(() => load().then(render));

        async function load() {
          const list = await providers.list();
          s.policy = await providers.policy();
          const last = await idb.getSetting(LAST_SETTING, '');
          if (!list.some((p) => p.id === s.providerId)) s.providerId = list.some((p) => p.id === last) ? last : (list[0] ? list[0].id : '');
          s.providers = list;
        }
        /** A question from the AI in the build mode, shown in the panel until the person answers or closes it. */
        function askPerson(q) {
          return new Promise((resolve) => {
            s.questionBox = { q, resolve: (v) => { s.questionBox = null; resolve(v); render(); } };
            if (q.signal) q.signal.addEventListener('abort', () => { if (s.questionBox) s.questionBox.resolve(null); }, { once: true });
            render();
          });
        }
        async function askNow() {
          const p = provider();
          const question = s.question.trim() || (s.mode === 'build' ? t('plan.ai.build.default') : '');
          if (s.busy || !p || !question) return;
          s.busy = true; s.error = ''; s.answer = ''; s.steps = []; s.areas = []; s.usage = null; render();
          abort = new AbortController();
          try {
            const kit = planTools.kit({ datasetId: options.datasetId, mode: s.mode, changeset: changing() ? s.changeset : null, env: { view: options.view, sources: options.sources } });
            const out = await agent.ask({ provider: p, datasetId: options.datasetId, question, history: s.history, kit, ask: s.mode === 'build' ? askPerson : undefined, signal: abort.signal,
              onEvent: (ev) => { if (ev.type === 'tool') { s.steps.push(ev.step); renderSteps(); } } });
            s.answer = out.answer; s.steps = out.steps; s.areas = out.elements.map(String); s.usage = out.usage;
            // The next question continues the conversation, with the words only.
            s.history = s.history.concat([{ role: 'user', content: question }, { role: 'assistant', content: out.answer }]).slice(-10);
            s.exchanges.push({ question, answer: out.answer });
            if (changing()) {
              // A preview shows one change set; a changed set needs a new one.
              if (out.steps.some((step) => WRITES.has(step.name))) dropPreview();
              log(t('ai.log.changes', { n: i18n.formatNumber(s.changeset.steps.length), tools: String(out.steps.length) }), out.stopped === 'answered' ? 'ok' : 'warn');
            } else log(t('ai.log.answered', { tools: String(out.steps.length), input: i18n.formatNumber(out.usage.input), output: i18n.formatNumber(out.usage.output) }), out.stopped === 'answered' ? 'ok' : 'warn');
            await idb.setSetting(LAST_SETTING, p.id);
          } catch (err) { fail(err); }
          abort = null; s.busy = false; s.question = ''; render();
        }
        function cancel() { if (abort) abort.abort(); }

        // ---- the change set on the map ----
        /** The shapes of the change set for the map: new and moved from the steps, changed and removed from the plan's rows. */
        function shapesOf(cs) {
          const rows = options.rows ? options.rows() || [] : [];
          const rowOf = (id) => rows.find((r) => planLinks.key(r.objektid) === planLinks.key(id)) || null;
          const added = new Map();
          const out = [];
          for (const step of cs.steps) {
            const n = step.note || {};
            if (step.op === 'plan_area_add' && n.geometry) { added.set(n.objektid, n.geometry); out.push({ kind: 'added', geometry: n.geometry }); }
            else if (step.op === 'plan_area_geometry' && n.geometry) out.push({ kind: 'changed', geometry: n.geometry });
            else if (step.op === 'plan_area_set' && !added.has(n.objektid)) { const r = rowOf(n.objektid); if (r && r.geometri) out.push({ kind: 'changed', geometry: JSON.parse(r.geometri) }); }
            else if (step.op === 'plan_area_delete') { const r = rowOf(n.objektid); if (r && r.geometri) out.push({ kind: 'deleted', geometry: JSON.parse(r.geometri) }); }
          }
          return out;
        }
        function removeLayer() {
          const m = options.map ? options.map() : null;
          if (layer && m && m.map) { m.map.removeLayer(layer); m.map.getContainer().removeAttribute('data-plan-ai-preview'); }
          layer = null;
        }
        /** The previewed shapes drawn over the plan, fitted when `fit`. */
        function drawPreview(fit) {
          removeLayer();
          const m = options.map ? options.map() : null;
          if (!s.preview || !m || !m.map || !m.L) return;
          const tk = theme.tokens();
          const color = { added: tk.ok, changed: tk.warn, deleted: tk.error };
          const styleOf = (kind) => ({ color: color[kind], weight: 3, fillColor: color[kind], fillOpacity: kind === 'deleted' ? 0.08 : 0.25, dashArray: kind === 'deleted' ? '6 4' : null, interactive: false });
          const features = s.preview.shapes.map((x) => ({ type: 'Feature', geometry: x.geometry, properties: { kind: x.kind } }));
          layer = m.L.geoJSON({ type: 'FeatureCollection', features }, { interactive: false, style: (f) => styleOf(f.properties.kind), pointToLayer: (f, at) => m.L.circleMarker(at, Object.assign({ radius: 8 }, styleOf(f.properties.kind))) }).addTo(m.map);
          m.map.getContainer().setAttribute('data-plan-ai-preview', String(features.length));
          const b = layer.getBounds && layer.getBounds();
          if (fit && b && b.isValid()) m.map.fitBounds(b, { padding: [24, 24], maxZoom: 16, animate: false });
        }
        function dropPreview() { s.preview = null; removeLayer(); }
        /** The change set tried on a copy of the plan, and its areas drawn on the map. The plan is untouched. */
        async function previewNow() {
          if (s.previewing || s.busy || !s.changeset.steps.length) return;
          s.previewing = true; s.error = ''; render();
          try {
            const tried = await planEdit.tryChanges(options.datasetId, planTools.toSteps(s.changeset));
            s.preview = { tried, errors: tried.filter((x) => !x.ok).length, shapes: shapesOf(s.changeset), steps: s.changeset.steps.length };
            drawPreview(true);
          } catch (err) { fail(err); }
          s.previewing = false; render();
        }
        const removals = () => s.changeset.steps.filter((x) => x.op === 'plan_area_delete' || x.op === 'plan_section_delete').length;
        /** The previewed change set as one step of the plan's log, with where it came from. */
        async function approveNow() {
          if (s.approving || s.busy || !s.preview || s.preview.errors || s.preview.steps !== s.changeset.steps.length) return;
          const n = removals();
          if (n && !(await ui.dialog.confirm(t('plan.ai.confirm.delete', { n }), { danger: true }))) return;
          s.approving = true; s.error = ''; render();
          try {
            const p = provider();
            const steps = s.changeset.steps.length;
            await planEdit.applyChanges(options.datasetId, planTools.toSteps(s.changeset), { tool: 'plan-ai', provider: p ? p.name : '', model: p ? p.model : '', questions: s.exchanges.map((x) => x.question.slice(0, 500)).slice(-5), at: new Date().toISOString() });
            s.changeset = planTools.create(options.datasetId);
            dropPreview();
            const msg = t('plan.ai.approved', { n: steps });
            log(msg, 'ok');
            ui.toast.show(msg, { kind: 'ok', timeout: 9000, action: { label: t('common.undo'), onClick: () => { undo().catch((err) => { fail(err); render(); }); } } });
            if (options.onApproved) options.onApproved();
          } catch (err) { fail(err); }
          s.approving = false; render();
        }
        /** The approved change set undone, when it is still the plan's last step. */
        async function undo() {
          if (recipes.undoLabel(options.datasetId) !== t('op.plan_changeset')) { ui.toast.show(t('plan.ai.undo.later'), { kind: 'info', timeout: 9000 }); return; }
          const label = await planEdit.undo(options.datasetId);
          log(t('bearbeta.undone', { label }), 'ok');
          if (options.onApproved) options.onApproved();
        }
        function rejectNow() {
          if (s.busy || s.previewing || s.approving) return;
          s.changeset = planTools.create(options.datasetId);
          dropPreview();
          render();
        }
        function mark() { if (s.areas.length && options.pick) options.pick(s.areas); }

        // ---- rendering ----
        function stepLine(step) {
          const args = Object.entries(step.args || {}).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `${k}=${typeof v === 'string' ? (v.length > 60 ? v.slice(0, 59) + '…' : v) : JSON.stringify(v).slice(0, 60)}`).join(', ');
          const tail = step.error ? t('ai.step.error', { error: step.error }) : (step.count !== null && step.count !== undefined ? t('ai.step.count', { n: i18n.formatNumber(step.count) }) : '');
          return h('li', { class: 'dm-small', text: `${step.name}(${args}) ${tail} · ${step.ms} ms` });
        }
        let stepsEl = null;
        function renderSteps() { if (stepsEl) replace(stepsEl, s.steps.length ? h('ol', { class: 'dm-list dm-xs', 'data-ai-steps': '' }, s.steps.map(stepLine)) : null); }
        /** A section's new heading and text, folded under its step. */
        function textOf(step) {
          const n = step.note || {};
          if ((step.op !== 'plan_section_add' && step.op !== 'plan_section_set') || n.text === null || n.text === undefined) return null;
          return h('details', { class: 'dm-more', 'data-plan-ai-text': n.avsnitt },
            h('summary', { text: t('plan.ai.text.show') }),
            n.heading ? h('p', { class: 'dm-small', text: n.heading }) : null,
            str(n.text).split('\n').filter(Boolean).map((para) => h('p', { class: 'dm-xs', text: para })));
        }
        function renderChanges() {
          const cs = s.changeset;
          const pv = s.preview && s.preview.steps === cs.steps.length ? s.preview : null;
          const errorAt = (i) => (pv && pv.tried[i] && !pv.tried[i].ok ? pv.tried[i].error : '');
          return h('div', { class: 'dm-stack-sm', 'data-plan-ai-changeset': String(cs.steps.length) },
            h('div', { class: 'dm-row' }, h('strong', { class: 'dm-grow', text: t('ai.change.title') }), h('span', { class: 'dm-help dm-xs', text: t('ai.change.steps', { n: i18n.formatNumber(cs.steps.length) }) })),
            cs.steps.length ? h('ol', { class: 'dm-list dm-xs', 'data-plan-ai-steps': '' }, cs.steps.map((step, i) => h('li', { class: errorAt(i) || /_delete$/.test(step.op) ? 'dm-small dm-error' : 'dm-small', 'data-plan-ai-step': step.op },
              h('span', { text: planTools.describe(step) }), errorAt(i) ? h('span', { class: 'dm-block dm-xs', 'data-plan-ai-step-error': '', text: errorAt(i) }) : null, textOf(step))))
              : h('p', { class: 'dm-help dm-xs', text: t('ai.change.empty') }),
            pv ? h('p', { class: pv.errors ? 'dm-error dm-small' : 'dm-help dm-xs', 'data-plan-ai-findings': String(pv.errors), text: pv.errors ? t('plan.ai.preview.errors', { n: pv.errors }) : t('plan.ai.preview.ok', { n: pv.shapes.length }) }) : null,
            h('div', { class: 'dm-row-wrap' },
              basic.button({ label: t('ai.change.preview'), icon: 'eye', size: 'sm', loading: s.previewing, disabled: !cs.steps.length || s.busy, title: t('plan.ai.preview.hint'), 'data-plan-ai-preview': '', onClick: previewNow }),
              basic.button({ label: t('ai.change.approve'), icon: 'check', size: 'sm', loading: s.approving, disabled: !pv || pv.errors > 0 || s.busy, title: t('plan.ai.approve.hint'), 'data-plan-ai-approve': '', onClick: approveNow }),
              basic.button({ label: t('ai.change.reject'), icon: 'x', size: 'sm', variant: 'ghost', disabled: !cs.steps.length || s.busy, title: t('plan.ai.reject.hint'), 'data-plan-ai-reject': '', onClick: rejectNow })));
        }
        function render() {
          const [sel, pol, mode] = aiPanel.controls(s, { modes: MODES, fail: (err) => { fail(err); render(); }, onMode: render, modeHint: t('plan.ai.mode.hint') });
          const q = /** @type {any} */ (h('dm-input', { label: t(s.mode === 'build' ? 'plan.ai.brief' : 'ai.question'), rows: s.mode === 'build' ? '6' : '3', placeholder: t('plan.ai.placeholder.' + s.mode), 'data-ai-question': '' }));
          q.value = s.question;
          q.addEventListener('input', () => { s.question = q.value; });
          q.addEventListener('keydown', (ev) => { const k = /** @type {KeyboardEvent} */ (ev); if (k.key === 'Enter' && (k.ctrlKey || k.metaKey)) { ev.preventDefault(); askNow(); } });
          stepsEl = h('div');
          const p = provider();
          replace(el,
            h('div', { class: 'dm-row' }, h('strong', { class: 'dm-grow', text: t('plan.ai.title.' + s.mode) }), basic.button({ label: t('ai.providers.manage'), icon: 'settings', size: 'sm', 'data-ai-providers': '', onClick: () => aiPanel.manage(ctx).then(() => load().then(render)) })),
            h('p', { class: 'dm-help dm-xs', text: t('plan.ai.hint.' + s.mode) }),
            s.providers.length ? h('div', { class: 'dm-row-wrap' }, sel, pol, mode) : h('p', { class: 'dm-help', 'data-ai-none': '', text: t('ai.providers.none') }),
            p && !providers.hasKey(p.id) && !providers.isLocal(p.baseUrl) ? h('p', { class: 'dm-help dm-xs', text: t('ai.key.missing', { name: p.name }) }) : null,
            q,
            s.questionBox ? aiPanel.questionBox(s.questionBox.q, s.questionBox.resolve) : null,
            h('div', { class: 'dm-row-wrap' },
              basic.button({ label: t(s.mode === 'build' ? 'plan.ai.build.run' : changing() ? 'ai.propose' : 'ai.ask'), icon: 'cpu', variant: 'primary', size: 'sm', loading: s.busy, disabled: !s.providers.length, 'data-ai-ask': '', onClick: askNow }),
              s.busy ? basic.button({ label: t('common.cancel'), size: 'sm', 'data-ai-cancel': '', onClick: cancel }) : null,
              s.areas.length && !s.busy && options.pick ? basic.button({ label: t('plan.ai.mark', { n: s.areas.length }), icon: 'list-checks', size: 'sm', title: t('plan.ai.mark.hint'), 'data-plan-ai-mark': '', onClick: mark }) : null),
            s.error ? h('p', { class: 'dm-error', 'data-ai-error': '', text: s.error }) : null,
            s.answer ? h('div', { class: 'dm-stack-sm', 'data-ai-answer': '' }, s.answer.split(/\n{2,}/).map((para) => h('p', { class: 'dm-small', text: para }))) : null,
            stepsEl,
            changing() ? renderChanges() : null,
            s.usage ? h('p', { class: 'dm-help dm-xs', 'data-ai-usage': '', text: t('ai.usage', { input: i18n.formatNumber(s.usage.input), output: i18n.formatNumber(s.usage.output) }) }) : null,
            s.exchanges.length > 1 ? h('p', { class: 'dm-help dm-xs', text: t('ai.history', { n: String(s.exchanges.length) }) }) : null);
          renderSteps();
        }
        /** The plan's map was drawn again: the preview goes on it again. */
        function mapDrawn() { if (s.preview) drawPreview(false); else layer = null; }
        function destroy() { unsubscribe(); cancel(); removeLayer(); if (s.questionBox) s.questionBox.resolve(null); }
        load().then(render).catch((err) => { fail(err); render(); });
        return { el, destroy, state: s, mapDrawn, load, preview: previewNow, approve: approveNow, reject: rejectNow, undo,
          ask: (question) => { s.question = question; return askNow(); }, setMode: (m) => { s.mode = MODES.includes(m) ? m : 'ask'; render(); } };
      }
      return { create, MODES };
    });
})();
