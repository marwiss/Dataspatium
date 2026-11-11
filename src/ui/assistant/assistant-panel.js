// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * AI-assistent: the floating panel where the AI works with the app's commands (Martin's F35 a, on trial; F30 a, F32 a, F34 a). It
 * opens from the status bar and the palette in every mode and keeps the conversation while the app is open. The person writes a
 * task; the steps the AI takes show as they happen; a writing command is approved in the app's own dialog with the real command and
 * its arguments; a question from the AI shows in the panel with a button per answer; a proposed plan can be saved as a flow, and so
 * can the writing steps that ran. Everything from the AI is shown as text only.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/assistant', ['ui/base', 'ui/basic', 'ui/overlays', 'ai/providers', 'ai/assistant', 'data/flows', 'data/commands', 'platform/storage/idb'],
    (base, basic, overlays, providers, assistant, flows, commands, idb) => {
      const { h, t, i18n } = base;
      const LAST_SETTING = 'assistant.lastProvider';
      /** One panel per page, kept while the app is open. */
      let current = null;

      /** The approval of a writing command: the app's own dialog, with the command and its arguments as text; `source` names who asks. */
      async function approve(cmd, args, options = {}) {
        let shown = '';
        try { shown = JSON.stringify(args, null, 2); } catch (_e) { shown = String(args); }
        const op = cmd.name === 'apply_operation' && args && args.operation ? t('op.' + args.operation) : '';
        const yes = await overlays.dialog.open({
          title: t('assistant.approve.title'),
          body: h('div', { class: 'dm-stack-sm', 'data-assistant-approve': cmd.name },
            h('p', { text: t(options.source === 'bridge' ? 'remote.approve.text' : 'assistant.approve.text', { name: cmd.name }) }),
            op && op !== 'op.' + args.operation ? h('p', null, h('strong', { text: op })) : null,
            h('pre', { class: 'dm-help-code', text: shown.length > 4000 ? shown.slice(0, 4000) + '…' : shown }),
            h('p', { class: 'dm-help dm-small', text: t('assistant.approve.hint') })),
          actions: [{ label: t('common.cancel'), value: false }, { label: t('assistant.approve.ok'), variant: 'primary', value: true, primary: true }],
        });
        return yes === true;
      }

      /** @param {any} ctx shell context */
      function open(ctx) {
        if (current) { current.panel.collapse(false); current.panel.focus(); return current; }
        const s = { providers: [], providerId: '', task: '', busy: false, error: '', exchanges: [], messages: [], question: null, controller: null };
        const panel = overlays.floating({ onClose: () => { if (s.controller) s.controller.abort(); if (s.question) s.question.resolve(null); current = null; } });
        panel.el.setAttribute('data-assistant', '');
        const log = (msg, kind) => { if (ctx && ctx.shell && ctx.shell.log) ctx.shell.log(msg, kind || 'ok'); };

        async function load() {
          s.providers = await providers.list();
          const last = await idb.getSetting(LAST_SETTING, '');
          if (!s.providers.some((p) => p.id === s.providerId)) s.providerId = (s.providers.find((p) => p.id === last) || s.providers[0] || { id: '' }).id;
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
          render();
          try {
            const r = await assistant.run({
              provider, task, history: s.messages, approve, ask, signal: s.controller.signal,
              onEvent: (ev) => { if (ev.type === 'step') { ex.steps.push(ev.step); render(); } else if (ev.type === 'plan') { ex.plan = ev.plan; render(); } },
            });
            ex.answer = r.answer; ex.usage = r.usage; ex.all = r.steps;
            s.messages = r.messages;
          } catch (err) {
            ex.error = String((err && err.message) || err);
          } finally {
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
        function questionView() {
          const { q, resolve } = s.question;
          const free = q.free ? /** @type {any} */ (h('dm-input', { label: t('ask.free') })) : null;
          return h('div', { class: 'dm-card dm-stack-sm dm-ask', 'data-ask': '' },
            h('p', { class: 'dm-ask-question', text: String(q.question || '').slice(0, 500) }),
            (q.options || []).slice(0, 6).map((o, i) => h('div', { class: 'dm-stack-sm dm-ask-option', 'data-ask-option': String(i) },
              basic.button({ label: String(o.label).slice(0, 80), title: o.description || o.label, onClick: () => resolve({ answer: o.label, index: i, free: false }) }),
              o.description ? h('p', { class: 'dm-help dm-small', text: String(o.description).slice(0, 200) }) : null)),
            free ? h('div', { class: 'dm-row-wrap dm-ask-free' }, free, basic.button({ label: t('ask.answer'), title: t('ask.answer.hint'), onClick: () => { const v = String(free.value || '').trim().slice(0, 500); if (v) resolve({ answer: v, index: null, free: true }); } })) : null,
            basic.button({ label: t('common.cancel'), variant: 'ghost', size: 'sm', title: t('assistant.question.cancel'), onClick: () => resolve(null) }));
        }
        function render() {
          const provider = s.providers.find((p) => p.id === s.providerId);
          const body = [];
          if (!s.providers.length) {
            body.push(h('p', { class: 'dm-help', text: t('ai.providers.none') }));
          } else if (s.providers.length > 1) {
            body.push(basic.select(t('ai.provider'), s.providers.map((p) => ({ value: p.id, label: p.name })), s.providerId, (v) => { s.providerId = v; render(); }));
          }
          if (!s.exchanges.length) body.push(h('p', { class: 'dm-help dm-small', text: t('assistant.intro', { n: commands.list().length }) }));
          for (const ex of s.exchanges) body.push(exchangeView(ex));
          if (s.question) body.push(questionView());
          if (s.busy && !s.question) body.push(h('p', { class: 'dm-help', text: t('assistant.working') }));
          const input = /** @type {any} */ (h('dm-input', { label: t('assistant.task'), type: 'textarea', rows: '3', placeholder: t('assistant.task.placeholder') }));
          input.value = s.task;
          input.addEventListener('input', () => { s.task = input.value; });
          input.addEventListener('keydown', (e) => { const k = /** @type {KeyboardEvent} */ (e); if (k.key === 'Enter' && (k.ctrlKey || k.metaKey)) { k.preventDefault(); send(); } });
          if (!s.busy) body.push(input);
          panel.update({
            title: t('assistant.title'),
            meta: provider ? provider.name : '',
            body,
            actions: [
              s.busy ? basic.button({ label: t('flows.cancel'), icon: 'octagon-x', title: t('assistant.stop.hint'), onClick: () => { if (s.controller) s.controller.abort(); } })
                : basic.button({ label: t('assistant.send'), icon: 'sparkles', variant: 'primary', title: t('assistant.send.hint'), disabled: !provider, onClick: send }),
              basic.button({ label: t('ai.providers.manage'), icon: 'settings', variant: 'ghost', title: t('ai.providers.title'), onClick: async () => { await D.require('ui/bearbeta/ai-panel').manage(ctx); await load(); render(); } }),
              s.exchanges.length && !s.busy ? basic.button({ label: t('assistant.new'), icon: 'plus', variant: 'ghost', title: t('assistant.new.hint'), onClick: () => { s.exchanges = []; s.messages = []; render(); } }) : null,
            ].filter(Boolean),
          });
        }
        current = { panel, state: s, send, render };
        load().then(render);
        render();
        return current;
      }
      return { open, approve, current: () => current };
    });
})();
