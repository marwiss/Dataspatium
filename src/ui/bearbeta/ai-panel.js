// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The panel "Fråga AI om modellen" in Bearbeta's model view (the inspector): choose a provider and the policy, ask a question about
 * the open IFC model, follow the tools the AI used, and mark the elements the answer rests on in the 3D view and the table. The AI
 * only reads; the keys live in api/secrets; nothing is sent without the consent for the provider's host. The dialog `providers`
 * adds, changes and removes providers (Anthropic Messages, OpenAI-compatible, local servers).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/ai-panel', ['ui/base', 'ui/basic', 'ui/overlays', 'ui/icons', 'ai/providers', 'ai/agent', 'data/selection', 'platform/storage/idb'],
    (base, basic, overlays, icons, providers, agent, selection, idb) => {
      const { h, t, i18n, replace } = base;
      const LAST_SETTING = 'ai.lastProvider';

      /**
       * @param {any} ctx shell context @param {{datasetId: string, onMarked?: Function}} options
       */
      function create(ctx, options) {
        const { shell } = ctx;
        const s = { providers: [], providerId: '', policy: 'ask', question: '', busy: false, answer: '', steps: [], elements: [], usage: null, error: '', history: [], exchanges: [] };
        const el = h('div', { class: 'dm-card dm-stack-sm', 'data-ai-panel': '' });
        let abort = null;
        const unsubscribe = providers.subscribe(() => load().then(render));
        const log = (msg, kind) => { if (shell && shell.log) shell.log(msg, kind || 'ok'); };
        const fail = (err) => { s.error = String((err && err.message) || err); log(`AI: ${s.error}`, 'error'); };

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
            const out = await agent.ask({ provider: p, datasetId: options.datasetId, question, history: s.history, signal: abort.signal, onEvent: (ev) => { if (ev.type === 'tool') { s.steps.push(ev.step); renderSteps(); } } });
            s.answer = out.answer; s.steps = out.steps; s.elements = out.elements; s.usage = out.usage;
            // The next question continues the conversation, but only the words: the tool traffic is not carried on.
            s.history = s.history.concat([{ role: 'user', content: question }, { role: 'assistant', content: out.answer }]).slice(-10);
            s.exchanges.push({ question, answer: out.answer, elements: out.elements.length });
            log(t('ai.log.answered', { tools: String(out.steps.length), input: i18n.formatNumber(out.usage.input), output: i18n.formatNumber(out.usage.output) }), out.stopped === 'answered' ? 'ok' : 'warn');
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
        function stepLine(step) {
          const args = Object.entries(step.args || {}).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(', ');
          const tail = step.error ? t('ai.step.error', { error: step.error }) : (step.count !== null && step.count !== undefined ? t('ai.step.count', { n: i18n.formatNumber(step.count) }) : '');
          return h('li', { class: 'dm-small', text: `${step.name}(${args}) ${tail} · ${step.ms} ms` });
        }
        let stepsEl = null;
        function renderSteps() { if (stepsEl) replace(stepsEl, s.steps.length ? h('ol', { class: 'dm-list dm-xs', 'data-ai-steps': '' }, s.steps.map(stepLine)) : null); }
        function render() {
          const sel = /** @type {any} */ (h('dm-select', { label: t('ai.provider') }));
          sel.options = s.providers.map((p) => ({ value: p.id, label: `${p.name} · ${p.model}${providers.isLocal(p.baseUrl) ? ' · ' + t('ai.local') : ''}` }));
          sel.value = s.providerId;
          sel.addEventListener('change', () => { s.providerId = sel.value; });
          const pol = /** @type {any} */ (h('dm-select', { label: t('ai.policy'), title: t('ai.policy.hint') }));
          pol.options = providers.POLICIES.map((id) => ({ value: id, label: t('ai.policy.' + id) }));
          pol.value = s.policy;
          pol.addEventListener('change', () => { providers.setPolicy(pol.value).then(() => { s.policy = pol.value; }).catch(fail); });
          const q = /** @type {any} */ (h('dm-input', { label: t('ai.question'), rows: '3', placeholder: t('ai.question.placeholder'), 'data-ai-question': '' }));
          q.value = s.question;
          q.addEventListener('input', () => { s.question = q.value; });
          q.addEventListener('keydown', (ev) => { if (/** @type {KeyboardEvent} */ (ev).key === 'Enter' && (/** @type {KeyboardEvent} */ (ev).ctrlKey || /** @type {KeyboardEvent} */ (ev).metaKey)) { ev.preventDefault(); askNow(); } });
          stepsEl = h('div');
          const p = provider();
          replace(el,
            h('div', { class: 'dm-row' }, h('strong', { class: 'dm-grow', text: t('ai.title') }), basic.button({ label: t('ai.providers.manage'), icon: 'settings', size: 'sm', 'data-ai-providers': '', onClick: () => manage(ctx).then(() => load().then(render)) })),
            h('p', { class: 'dm-help dm-xs', text: t('ai.hint') }),
            s.providers.length ? h('div', { class: 'dm-row-wrap' }, sel, pol) : h('p', { class: 'dm-help', 'data-ai-none': '', text: t('ai.providers.none') }),
            p && !providers.hasKey(p.id) && !providers.isLocal(p.baseUrl) ? h('p', { class: 'dm-help dm-xs', text: t('ai.key.missing', { name: p.name }) }) : null,
            q,
            h('div', { class: 'dm-row-wrap' },
              basic.button({ label: t('ai.ask'), icon: 'cpu', variant: 'primary', size: 'sm', loading: s.busy, disabled: !s.providers.length, 'data-ai-ask': '', onClick: askNow }),
              s.busy ? basic.button({ label: t('common.cancel'), size: 'sm', 'data-ai-cancel': '', onClick: cancel }) : null,
              s.elements.length && !s.busy ? basic.button({ label: t('ai.mark', { n: i18n.formatNumber(s.elements.length) }), icon: 'list-checks', size: 'sm', 'data-ai-mark': '', onClick: mark }) : null),
            s.error ? h('p', { class: 'dm-error', 'data-ai-error': '', text: s.error }) : null,
            s.answer ? h('div', { class: 'dm-stack-sm', 'data-ai-answer': '' }, s.answer.split(/\n{2,}/).map((para) => h('p', { class: 'dm-small', text: para }))) : null,
            stepsEl,
            s.usage ? h('p', { class: 'dm-help dm-xs', 'data-ai-usage': '', text: t('ai.usage', { input: i18n.formatNumber(s.usage.input), output: i18n.formatNumber(s.usage.output) }) }) : null,
            s.exchanges.length > 1 ? h('p', { class: 'dm-help dm-xs', text: t('ai.history', { n: String(s.exchanges.length) }) }) : null);
          renderSteps();
        }
        function destroy() { unsubscribe(); cancel(); }
        load().then(render);
        return { el, destroy, state: s, ask: (question) => { s.question = question; return askNow(); }, mark, load };
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
