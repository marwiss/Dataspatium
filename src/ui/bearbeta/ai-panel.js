// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The panel "Fråga AI om modellen" in Bearbeta's model view (the inspector): choose a provider and the policy, ask a question about
 * the open IFC model, follow the tools the AI used, and mark the elements the answer rests on in the 3D view and the table. In the
 * mode Ändra the AI proposes changes through the write tools instead: they fill a change set that the person previews (the candidate
 * file drawn in 3D, new elements green and changed ones yellow, the schema findings listed) and approves or rejects. An approved
 * change set becomes the recipe step ifc_changeset, with undo and a new version of the model; deletions are confirmed once more. The
 * keys live in api/secrets; nothing is sent without the consent for the provider's host. The dialog `providers` adds, changes and
 * removes providers (Anthropic Messages, OpenAI-compatible, local servers).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/ai-panel', ['ui/base', 'ui/basic', 'ui/overlays', 'ui/icons', 'ai/providers', 'ai/agent', 'ai/write-tools', 'data/selection', 'data/recipes', 'data/ifc-ops', 'platform/storage/idb'],
    (base, basic, overlays, icons, providers, agent, writeTools, selection, recipes, ifcOps, idb) => {
      const { h, t, i18n, replace } = base;
      const LAST_SETTING = 'ai.lastProvider';
      const MODES = ['ask', 'change'];
      const cssColor = (name) => ((globalThis.getComputedStyle ? getComputedStyle(document.documentElement).getPropertyValue(name) : '') || '').trim() || '#888888';

      /**
       * @param {any} ctx shell context
       * @param {{datasetId: string, onMarked?: Function, preview?: (preview: {bytes?: Uint8Array|null, colors?: Array<{color: string, ids: number[]}>}|null) => any, onApproved?: Function}} options
       */
      function create(ctx, options) {
        const { shell } = ctx;
        const s = { providers: [], providerId: '', policy: 'ask', mode: 'ask', question: '', busy: false, answer: '', steps: [], elements: [], usage: null, error: '', history: [], exchanges: [],
          changeset: writeTools.create(options.datasetId), preview: null, previewing: false, approving: false };
        const el = h('div', { class: 'dm-card dm-stack-sm', 'data-ai-panel': '' });
        let abort = null;
        const unsubscribe = providers.subscribe(() => load().then(render));
        const log = (msg, kind) => { if (shell && shell.log) shell.log(msg, kind || 'ok'); };
        const fail = (err) => { s.error = String((err && err.message) || err); log(`AI: ${s.error}`, 'error'); };
        const changing = () => s.mode === 'change';

        async function load() {
          s.providers = await providers.list();
          s.policy = await providers.policy();
          const last = await idb.getSetting(LAST_SETTING, '');
          if (!s.providers.some((p) => p.id === s.providerId)) s.providerId = s.providers.some((p) => p.id === last) ? last : (s.providers[0] ? s.providers[0].id : '');
        }
        const provider = () => s.providers.find((p) => p.id === s.providerId) || null;
        async function askNow() {
          const p = provider();
          const question = s.question.trim();
          if (s.busy || !p || !question) return;
          s.busy = true; s.error = ''; s.answer = ''; s.steps = []; s.elements = []; s.usage = null; render();
          abort = new AbortController();
          try {
            const out = await agent.ask({ provider: p, datasetId: options.datasetId, question, history: s.history, changeset: changing() ? s.changeset : null, signal: abort.signal, onEvent: (ev) => { if (ev.type === 'tool') { s.steps.push(ev.step); renderSteps(); } } });
            s.answer = out.answer; s.steps = out.steps; s.elements = out.elements; s.usage = out.usage;
            // The next question continues the conversation, but only the words: the tool traffic is not carried on.
            s.history = s.history.concat([{ role: 'user', content: question }, { role: 'assistant', content: out.answer }]).slice(-10);
            s.exchanges.push({ question, answer: out.answer, elements: out.elements.length });
            if (changing()) {
              // A preview shows one change set; a changed set needs a new one.
              if (out.steps.some((step) => writeTools.has(step.name))) await dropPreview();
              log(t('ai.log.changes', { n: i18n.formatNumber(s.changeset.ops.length), tools: String(out.steps.length) }), out.stopped === 'answered' ? 'ok' : 'warn');
            } else log(t('ai.log.answered', { tools: String(out.steps.length), input: i18n.formatNumber(out.usage.input), output: i18n.formatNumber(out.usage.output) }), out.stopped === 'answered' ? 'ok' : 'warn');
            await idb.setSetting(LAST_SETTING, p.id);
          } catch (err) { fail(err); }
          abort = null; s.busy = false; s.question = ''; render();
        }
        function cancel() { if (abort) abort.abort(); }
        /** The elements of the answer into the shared selection, which the 3D view and the table follow. */
        async function mark() {
          if (!s.elements.length) return;
          const made = await selection.setFromWhere(options.datasetId, `id in (${s.elements.map(Number).filter(Number.isFinite).join(', ')})`, [], t('ai.selection.label'));
          if (made && options.onMarked) options.onMarked(made);
          overlays.toast.show(made ? t('selection.made', { n: i18n.formatNumber(made.rowids.length) }) : t('selection.none'), { kind: made ? 'ok' : 'info' });
        }

        // ---- the change set ------------------------------------------------------------------------------------
        /** New elements green, changed ones yellow, for the 3D view. @param {any} report */
        function colorsOf(report) {
          const ids = (list) => (list || []).map((e) => Number(e.id)).filter(Number.isFinite);
          return [{ color: cssColor('--dm-ok'), ids: ids(report && report.created) }, { color: cssColor('--dm-warn'), ids: ids(report && report.changed) }].filter((g) => g.ids.length);
        }
        async function dropPreview() {
          const had = !!s.preview;
          s.preview = null;
          if (had && options.preview) await options.preview(null);
        }
        /** The change set on a copy of the model: the candidate drawn in 3D and the wheel's report shown. The dataset is untouched. */
        async function previewNow() {
          if (s.previewing || s.busy || !s.changeset.ops.length) return;
          s.previewing = true; s.error = ''; render();
          try {
            const out = await ifcOps.previewChangeset(options.datasetId, writeTools.toWheel(s.changeset));
            s.preview = { report: out.report || {}, bytes: out.bytes };
            if (options.preview) await options.preview({ bytes: out.bytes, colors: colorsOf(out.report) });
          } catch (err) { fail(err); }
          s.previewing = false; render();
        }
        const deletions = () => s.changeset.ops.filter((op) => op.tool === 'delete_elements').reduce((n, op) => n + op.ids.length, 0);
        /** The previewed change set as a recipe step: undoable, logged with its provenance, a new version of the model. */
        async function approveNow() {
          const report = s.preview && s.preview.report;
          if (s.approving || s.busy || !report || Number(report.errors) > 0) return;
          const n = deletions();
          if (n && !(await overlays.dialog.confirm(t('ai.change.confirm.delete', { n: i18n.formatNumber(n) }), { danger: true }))) return;
          s.approving = true; s.error = ''; render();
          try {
            const p = provider();
            const provenance = { provider: p ? p.name : '', model: p ? p.model : '', questions: s.exchanges.map((x) => x.question).slice(-5), at: new Date().toISOString() };
            const colors = colorsOf(report);
            // The colours first: the redraw that the new version causes then shows them on the changed model.
            s.preview = null;
            if (options.preview) await options.preview(colors.length ? { colors } : null);
            const result = await recipes.apply(options.datasetId, 'ifc_changeset', { changes: JSON.stringify(writeTools.toWheel(s.changeset)), provenance: JSON.stringify(provenance) });
            s.changeset = writeTools.create(options.datasetId);
            const msg = t('ai.change.approved', { created: i18n.formatNumber((report.created || []).length), changed: i18n.formatNumber((report.changed || []).length), deleted: i18n.formatNumber((report.deleted || []).length) });
            log(msg, 'ok'); overlays.toast.show(msg, { kind: 'ok', timeout: 8000 });
            if (options.onApproved) options.onApproved(result);
          } catch (err) { fail(err); }
          s.approving = false; render();
        }
        async function rejectNow() {
          if (s.busy || s.previewing || s.approving) return;
          s.changeset = writeTools.create(options.datasetId);
          await dropPreview();
          render();
        }

        // ---- rendering -----------------------------------------------------------------------------------------
        function stepLine(step) {
          const args = Object.entries(step.args || {}).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(', ');
          const tail = step.error ? t('ai.step.error', { error: step.error }) : (step.count !== null && step.count !== undefined ? t('ai.step.count', { n: i18n.formatNumber(step.count) }) : '');
          return h('li', { class: 'dm-small', text: `${step.name}(${args}) ${tail} · ${step.ms} ms` });
        }
        let stepsEl = null;
        function renderSteps() { if (stepsEl) replace(stepsEl, s.steps.length ? h('ol', { class: 'dm-list dm-xs', 'data-ai-steps': '' }, s.steps.map(stepLine)) : null); }
        function renderChanges() {
          const cs = s.changeset;
          const report = s.preview && s.preview.report;
          const errors = report ? Number(report.errors) || 0 : 0;
          const finding = (f) => h('li', { class: 'dm-xs', text: `${f.ifc_class || ''}${f.id ? ' #' + f.id : ''}${f.attribute ? ' ' + f.attribute : ''}: ${f.message || ''}` });
          return h('div', { class: 'dm-stack-sm', 'data-ai-changeset': '' },
            h('div', { class: 'dm-row' }, h('strong', { class: 'dm-grow', text: t('ai.change.title') }), h('span', { class: 'dm-help dm-xs', 'data-ai-change-count': '', text: t('ai.change.steps', { n: i18n.formatNumber(cs.ops.length) }) })),
            cs.ops.length ? h('ol', { class: 'dm-list dm-xs', 'data-ai-changes': '' }, cs.ops.map((op) => h('li', { class: op.tool === 'delete_elements' ? 'dm-small dm-error' : 'dm-small', text: writeTools.describe(op) }))) : h('p', { class: 'dm-help dm-xs', text: t('ai.change.empty') }),
            report ? h('div', { class: 'dm-stack-sm', 'data-ai-report': '' },
              h('p', { class: 'dm-small', text: t('ai.change.report', { created: i18n.formatNumber((report.created || []).length), changed: i18n.formatNumber((report.changed || []).length), deleted: i18n.formatNumber((report.deleted || []).length) }) }),
              h('p', { class: errors ? 'dm-error dm-small' : 'dm-help dm-xs', 'data-ai-findings': String(errors), text: errors ? t('ai.change.findings', { n: i18n.formatNumber(errors) }) : t('ai.change.findings.none') }),
              Array.isArray(report.findings) && report.findings.length ? h('ul', { class: 'dm-list dm-xs' }, report.findings.slice(0, 10).map(finding)) : null) : null,
            h('div', { class: 'dm-row-wrap' },
              basic.button({ label: t('ai.change.preview'), icon: 'eye', size: 'sm', loading: s.previewing, disabled: !cs.ops.length || s.busy, title: t('ai.change.preview.hint'), 'data-ai-preview': '', onClick: previewNow }),
              basic.button({ label: t('ai.change.approve'), icon: 'check', size: 'sm', loading: s.approving, disabled: !report || errors > 0 || s.busy, title: t('ai.change.approve.hint'), 'data-ai-approve': '', onClick: approveNow }),
              basic.button({ label: t('ai.change.reject'), icon: 'x', size: 'sm', variant: 'ghost', disabled: !cs.ops.length || s.busy, title: t('ai.change.reject.hint'), 'data-ai-reject': '', onClick: rejectNow })),
            h('p', { class: 'dm-help dm-xs', text: t('ai.change.python') }));
        }
        function render() {
          const sel = /** @type {any} */ (h('dm-select', { label: t('ai.provider') }));
          sel.options = s.providers.map((p) => ({ value: p.id, label: `${p.name} · ${p.model}${providers.isLocal(p.baseUrl) ? ' · ' + t('ai.local') : ''}` }));
          sel.value = s.providerId;
          sel.addEventListener('change', () => { s.providerId = sel.value; });
          const pol = /** @type {any} */ (h('dm-select', { label: t('ai.policy'), title: t('ai.policy.hint') }));
          pol.options = providers.POLICIES.map((id) => ({ value: id, label: t('ai.policy.' + id) }));
          pol.value = s.policy;
          pol.addEventListener('change', () => { providers.setPolicy(pol.value).then(() => { s.policy = pol.value; }).catch(fail); });
          const mode = /** @type {any} */ (h('dm-select', { label: t('ai.mode'), title: t('ai.mode.hint'), 'data-ai-mode': '' }));
          mode.options = MODES.map((id) => ({ value: id, label: t('ai.mode.' + id) }));
          mode.value = s.mode;
          mode.addEventListener('change', () => { s.mode = MODES.includes(mode.value) ? mode.value : 'ask'; render(); });
          const q = /** @type {any} */ (h('dm-input', { label: t('ai.question'), rows: '3', placeholder: t(changing() ? 'ai.question.placeholder.change' : 'ai.question.placeholder'), 'data-ai-question': '' }));
          q.value = s.question;
          q.addEventListener('input', () => { s.question = q.value; });
          q.addEventListener('keydown', (ev) => { if (/** @type {KeyboardEvent} */ (ev).key === 'Enter' && (/** @type {KeyboardEvent} */ (ev).ctrlKey || /** @type {KeyboardEvent} */ (ev).metaKey)) { ev.preventDefault(); askNow(); } });
          stepsEl = h('div');
          const p = provider();
          replace(el,
            h('div', { class: 'dm-row' }, h('strong', { class: 'dm-grow', text: t(changing() ? 'ai.title.change' : 'ai.title') }), basic.button({ label: t('ai.providers.manage'), icon: 'settings', size: 'sm', 'data-ai-providers': '', onClick: () => manage(ctx).then(() => load().then(render)) })),
            h('p', { class: 'dm-help dm-xs', text: t(changing() ? 'ai.hint.change' : 'ai.hint') }),
            s.providers.length ? h('div', { class: 'dm-row-wrap' }, sel, pol, mode) : h('p', { class: 'dm-help', 'data-ai-none': '', text: t('ai.providers.none') }),
            p && !providers.hasKey(p.id) && !providers.isLocal(p.baseUrl) ? h('p', { class: 'dm-help dm-xs', text: t('ai.key.missing', { name: p.name }) }) : null,
            q,
            h('div', { class: 'dm-row-wrap' },
              basic.button({ label: t(changing() ? 'ai.propose' : 'ai.ask'), icon: 'cpu', variant: 'primary', size: 'sm', loading: s.busy, disabled: !s.providers.length, 'data-ai-ask': '', onClick: askNow }),
              s.busy ? basic.button({ label: t('common.cancel'), size: 'sm', 'data-ai-cancel': '', onClick: cancel }) : null,
              s.elements.length && !s.busy ? basic.button({ label: t('ai.mark', { n: i18n.formatNumber(s.elements.length) }), icon: 'list-checks', size: 'sm', 'data-ai-mark': '', onClick: mark }) : null),
            s.error ? h('p', { class: 'dm-error', 'data-ai-error': '', text: s.error }) : null,
            s.answer ? h('div', { class: 'dm-stack-sm', 'data-ai-answer': '' }, s.answer.split(/\n{2,}/).map((para) => h('p', { class: 'dm-small', text: para }))) : null,
            stepsEl,
            changing() ? renderChanges() : null,
            s.usage ? h('p', { class: 'dm-help dm-xs', 'data-ai-usage': '', text: t('ai.usage', { input: i18n.formatNumber(s.usage.input), output: i18n.formatNumber(s.usage.output) }) }) : null,
            s.exchanges.length > 1 ? h('p', { class: 'dm-help dm-xs', text: t('ai.history', { n: String(s.exchanges.length) }) }) : null);
          renderSteps();
        }
        function destroy() { unsubscribe(); cancel(); if (s.preview && options.preview) { s.preview = null; Promise.resolve(options.preview(null)).catch(() => {}); } }
        load().then(render);
        return { el, destroy, state: s, ask: (question) => { s.question = question; return askNow(); }, mark, load, preview: previewNow, approve: approveNow, reject: rejectNow, setMode: (m) => { s.mode = MODES.includes(m) ? m : 'ask'; render(); } };
      }

      /** The dialog that lists the providers and adds, changes or removes one; the key is written, never shown. */
      async function manage(_ctx) {
        for (;;) {
          const all = await providers.list();
          const rows = all.map((p) => h('div', { class: 'dm-row', 'data-ai-provider': p.id },
            h('span', { class: 'dm-grow dm-small', text: `${p.name} · ${t('ai.kind.' + p.kind)} · ${p.model} · ${providers.hostOf(p.baseUrl)}${providers.hasKey(p.id) ? '' : ' · ' + t('ai.key.none')}` }),
            basic.button({ label: t('common.edit'), size: 'sm', onClick: () => done({ edit: p }) }),
            basic.button({ label: t('ai.providers.remove'), size: 'sm', variant: 'ghost', onClick: () => done({ remove: p }) })));
          let done = () => {};
          const chosen = await overlays.dialog.open({
            title: t('ai.providers.title'),
            body: (finish) => { done = finish; return h('div', { class: 'dm-stack-sm' }, h('p', { class: 'dm-help', text: t('ai.providers.hint') }), rows.length ? rows : h('p', { class: 'dm-help', text: t('ai.providers.none') })); },
            actions: [{ label: t('common.close'), value: null }, { label: t('ai.providers.add'), variant: 'primary', value: 'add', primary: true }],
          });
          if (!chosen) return;
          if (chosen === 'add') await edit(null);
          else if (chosen.edit) await edit(chosen.edit);
          else if (chosen.remove) { if (await overlays.dialog.confirm(t('ai.providers.remove.confirm', { name: chosen.remove.name }), { danger: true })) await providers.remove(chosen.remove.id); }
        }
      }
      /** One provider's form: a preset to start from, then kind, name, address, model and key. */
      async function edit(existing) {
        const values = Object.assign({ kind: 'anthropic', name: '', baseUrl: providers.KINDS.anthropic.baseUrl, model: providers.KINDS.anthropic.model }, existing || {});
        let error = '';
        for (;;) {
          const preset = /** @type {any} */ (h('dm-select', { label: t('ai.preset') }));
          preset.options = [{ value: '', label: t('ai.preset.own') }].concat(providers.PRESETS.map((p) => ({ value: p.id, label: t(p.nameKey) })));
          preset.value = '';
          const kind = /** @type {any} */ (h('dm-select', { label: t('ai.kind') }));
          kind.options = Object.keys(providers.KINDS).map((k) => ({ value: k, label: t(providers.KINDS[k].labelKey) }));
          kind.value = values.kind;
          const name = /** @type {any} */ (h('dm-input', { label: t('ai.name'), value: values.name }));
          const baseUrl = /** @type {any} */ (h('dm-input', { label: t('ai.baseUrl'), value: values.baseUrl, placeholder: 'https://…' }));
          const model = /** @type {any} */ (h('dm-input', { label: t('ai.model'), value: values.model }));
          const key = /** @type {any} */ (h('dm-input', { label: t('ai.key'), type: 'password', help: t('ai.key.hint'), placeholder: existing && providers.hasKey(existing.id) ? t('ai.key.kept') : '' }));
          preset.addEventListener('change', () => { const p = providers.PRESETS.find((x) => x.id === preset.value); if (!p) return; kind.value = p.kind; name.value = t(p.nameKey); baseUrl.value = p.baseUrl; model.value = p.model; });
          const body = h('div', { class: 'dm-stack-sm' }, existing ? null : preset, kind, name, baseUrl, model, key, error ? h('p', { class: 'dm-error', text: error }) : null);
          const ok = await overlays.dialog.open({ title: existing ? t('ai.providers.edit') : t('ai.providers.add'), body, actions: [{ label: t('common.cancel'), value: false }, { label: t('common.save'), variant: 'primary', value: true, primary: true }] });
          Object.assign(values, { kind: kind.value, name: name.value, baseUrl: baseUrl.value, model: model.value });
          if (ok !== true) return null;
          try {
            const saved = await providers.save(values);
            if (key.value) providers.setKey(saved.id, key.value);
            return saved;
          } catch (err) { error = String((err && err.message) || err); }
        }
      }
      return { create, manage, edit };
    });
})();
