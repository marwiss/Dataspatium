// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * AI-assistent: the floating panel where the AI works with the app's commands (decision F35 a, on trial; F30 a, F32 a, F34 a). It
 * opens from the status bar and the palette in every mode and keeps the conversation while the app is open. The person writes a
 * task; the steps the AI takes show as they happen; a writing command is approved in the app's own dialog with the real command and
 * its arguments; a question from the AI shows in the panel with a button per answer; a proposed plan can be saved as a flow, and so
 * can the writing steps that ran. The conversation is remembered between sessions as a notebook of the workspace (F37 b, on
 * trial): earlier exchanges go to the provider as history, and Nytt samtal forgets them. Everything from the AI is shown as text only.
 * While the AI works a status line above the conversation says what it does, with its text as it is written, its time and the tokens,
 * and a question from the AI comes first in the panel (ui/bearbeta/ai-run, B-83).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/assistant', ['ui/base', 'ui/basic', 'ui/overlays', 'ai/providers', 'ai/assistant', 'data/flows', 'data/commands', 'platform/storage/idb', 'ui/approve', 'ui/bearbeta/ai-run', 'ui/bearbeta/ai-providers'],
    (base, basic, overlays, providers, assistant, flows, commands, idb, approval, aiRun, aiProviders) => {
      const { h, t, i18n } = base;
      const LAST_SETTING = 'assistant.lastProvider';
      /** One panel per page, kept while the app is open. */
      let current = null;
      /** The approval of a writing command (ui/approve, in the start list, which the bridge's approval uses as well). */
      const approve = approval.approve;

      /** @param {any} ctx shell context */
      function open(ctx) {
        if (current) { current.panel.collapse(false); current.panel.focus(); return current; }
        const s = { providers: [], providerId: '', task: '', busy: false, error: '', exchanges: [], messages: [], earlier: [], question: null, controller: null };
        // What the run does now, above the conversation, and the question brought forward once when it comes (B-83).
        const run = aiRun.create({ onChange: () => render() });
        let shownQuestion = null;
        // Where the chosen provider's key is, kept up to date.
        const keys = aiProviders.keyWatch(() => s.providers.find((p) => p.id === s.providerId) || null, () => render());
        const panel = overlays.floating({ onClose: () => { if (s.controller) s.controller.abort(); if (s.question) s.question.resolve(null); run.stop(); keys.destroy(); current = null; } });
        panel.el.setAttribute('data-assistant', '');
        const log = (msg, kind) => { if (ctx && ctx.shell && ctx.shell.log) ctx.shell.log(msg, kind || 'ok'); };

        async function load() {
          s.providers = await providers.list();
          s.earlier = await assistant.recall().catch(() => []);
          const last = await idb.getSetting(LAST_SETTING, '');
          if (!s.providers.some((p) => p.id === s.providerId)) s.providerId = (s.providers.find((p) => p.id === last) || s.providers[0] || { id: '' }).id;
          await keys.refresh();
        }
        /** A question from the AI, shown in the panel until the person answers or closes it. */
        function ask(q) {
          return new Promise((resolve) => {
            s.question = { q, resolve: (v) => { s.question = null; resolve(v); render(); } };
            if (q.signal) q.signal.addEventListener('abort', () => { if (s.question) s.question.resolve(null); }, { once: true });
            render();
          });
        }
        async function send() {
          const task = String(s.task || '').trim();
          const provider = s.providers.find((p) => p.id === s.providerId);
          if (!task || !provider || s.busy) return;
          await idb.setSetting(LAST_SETTING, provider.id).catch(() => {});
          const ex = { task, steps: [], answer: '', plan: null, usage: null, error: '' };
          s.exchanges.push(ex); s.task = ''; s.busy = true; s.error = '';
          s.controller = new AbortController();
          run.start();
          render();
          try {
            const r = await assistant.run({
              provider, task, history: assistant.historyOf(s.earlier).concat(s.messages), approve, ask: run.ask(ask), signal: s.controller.signal,
              onEvent: (ev) => { run.event(ev); if (ev.type === 'step') { ex.steps.push(ev.step); render(); } else if (ev.type === 'plan') { ex.plan = ev.plan; render(); } },
            });
            ex.answer = r.answer; ex.usage = r.usage; ex.all = r.steps;
            s.messages = r.messages;
            if (r.stopped === 'answered' && r.answer) assistant.remember({ task, answer: r.answer }).catch((err) => console.error('[assistant] memory', err));
          } catch (err) {
            ex.error = String((err && err.message) || err);
          } finally {
            run.stop();
            s.busy = false; s.controller = null; render();
          }
        }
        async function saveFlow(flow) {
          try {
            const saved = await flows.save(flow);
            log(t('flows.saved', { name: saved.name }), 'ok');
            overlays.toast.show(t('assistant.flow.saved', { name: saved.name }), { kind: 'ok', action: { label: t('assistant.flow.open'), onClick: () => ctx.shell.openFlows('flows') } });
          } catch (err) { overlays.toast.show(String((err && err.message) || err), { kind: 'error' }); }
        }
        function stepLine(step) {
          const state = step.ok ? t('assistant.step.ok') : step.refused ? t('assistant.step.refused') : t('assistant.step.failed');
          return h('li', { class: step.ok ? '' : 'dm-error', 'data-assistant-step': step.command },
            h('code', { text: step.command }), h('span', { text: ' · ' + state + (step.error && !step.refused ? ': ' + String(step.error).slice(0, 200) : '') }));
        }
        function exchangeView(ex) {
          const writes = (ex.all || []).filter((x) => x.ok && x.writes).length;
          return h('div', { class: 'dm-stack-sm dm-assistant-exchange' },
            h('p', { class: 'dm-assistant-task', text: ex.task }),
            ex.steps.length ? h('ul', { class: 'dm-stack-sm dm-flow-log' }, ex.steps.map(stepLine)) : null,
            ex.plan ? h('div', { class: 'dm-card dm-stack-sm', 'data-assistant-plan': '' },
              h('strong', { text: t('assistant.plan', { name: ex.plan.name || t('flows.untitled') }) }),
              h('p', { class: 'dm-help dm-small', text: t('flows.steps.n', { n: ex.plan.steps.length }) + ' · ' + ex.plan.steps.map((x) => t('flows.step.' + x.type)).join(', ') }),
              basic.button({ label: t('assistant.plan.save'), icon: 'save', size: 'sm', title: t('assistant.plan.save.hint'), onClick: () => saveFlow(ex.plan) })) : null,
            ex.answer ? h('p', { class: 'dm-assistant-answer', text: ex.answer }) : null,
            ex.error ? h('p', { class: 'dm-error', text: ex.error }) : null,
            writes ? basic.button({ label: t('assistant.steps.save'), icon: 'list-checks', size: 'sm', title: t('assistant.steps.save.hint'), onClick: () => saveFlow(assistant.toFlow(ex.all, ex.task.slice(0, 60))) }) : null,
            ex.usage ? h('p', { class: 'dm-help dm-small', text: t('ai.usage', { input: i18n.formatNumber(ex.usage.input), output: i18n.formatNumber(ex.usage.output) }) }) : null);
        }
        /** The AI's question, shared with the model's panel (ui/bearbeta/ai-run). */
        function questionView() { return aiRun.questionBox(s.question.q, s.question.resolve); }
        function render() {
          const provider = s.providers.find((p) => p.id === s.providerId);
          const body = [];
          // A question from the AI comes first, marked, while the run waits for the answer (B-83).
          if (s.question) body.push(questionView());
          if (!s.providers.length) {
            body.push(h('p', { class: 'dm-help', text: t('ai.providers.none') }));
          } else if (s.providers.length > 1) {
            body.push(basic.select(t('ai.provider'), s.providers.map((p) => ({ value: p.id, label: `${p.name} · ${p.model}` })), s.providerId, (v) => { s.providerId = v; keys.refresh().then(render); }));
          }
          const notice = aiProviders.keyNotice(provider, keys.state, () => keys.refresh().then(render));
          if (notice) body.push(notice);
          // The run's status above the conversation.
          body.push(run.view());
          if (!s.exchanges.length) body.push(h('p', { class: 'dm-help dm-small', text: t('assistant.intro', { n: commands.list().length }) }));
          if (s.earlier.length) body.push(h('p', { class: 'dm-help dm-small', 'data-assistant-memory': String(s.earlier.length), text: t('assistant.memory', { n: s.earlier.length, name: t('assistant.title') }) }));
          for (const ex of s.exchanges) body.push(exchangeView(ex));
          const input = /** @type {any} */ (h('dm-input', { label: t('assistant.task'), type: 'textarea', rows: '3', placeholder: t('assistant.task.placeholder') }));
          input.value = s.task;
          input.addEventListener('input', () => { s.task = input.value; });
          input.addEventListener('keydown', (e) => { const k = /** @type {KeyboardEvent} */ (e); if (k.key === 'Enter' && (k.ctrlKey || k.metaKey)) { k.preventDefault(); send(); } });
          if (!s.busy) body.push(input);
          panel.update({
            title: t('assistant.title'),
            // The provider and the model it runs, chosen in the providers' dialog or the model's panel.
            meta: provider ? `${provider.name} · ${provider.model}` : '',
            body,
            actions: [
              s.busy ? basic.button({ label: t('flows.cancel'), icon: 'octagon-x', title: t('assistant.stop.hint'), onClick: () => { if (s.controller) s.controller.abort(); } })
                : basic.button({ label: t('assistant.send'), icon: 'sparkles', variant: 'primary', title: t('assistant.send.hint'), disabled: !provider, onClick: send }),
              basic.button({ label: t('ai.providers.manage'), icon: 'settings', variant: 'ghost', title: t('ai.providers.title'), onClick: async () => { await aiProviders.manage(ctx); await load(); render(); } }),
              (s.exchanges.length || s.earlier.length) && !s.busy ? basic.button({ label: t('assistant.new'), icon: 'plus', variant: 'ghost', title: t('assistant.new.hint'), onClick: () => { s.exchanges = []; s.messages = []; s.earlier = []; assistant.forget().catch((err) => console.error('[assistant] memory', err)); render(); } }) : null,
            ].filter(Boolean),
          });
          const asked = s.question ? s.question.q : null;
          if (asked && asked !== shownQuestion) aiRun.reveal(panel.el);
          shownQuestion = asked;
        }
        current = { panel, state: s, send, render, run };
        load().then(render);
        render();
        return current;
      }
      return { open, approve, current: () => current };
    });
})();
