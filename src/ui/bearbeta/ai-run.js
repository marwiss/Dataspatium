// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * What an AI run is doing, for every panel that runs the loop (B-83): the model's panel (ui/bearbeta/ai-panel, with its mode
 * Kontrollera), the plan's (ui/bearbeta/plan-ai) and the AI assistant (ui/assistant). A compact status line above the conversation
 * says what happens now (the AI thinks, writes, prepares a tool, or the app runs one, in words), the AI's time, the tokens when the
 * provider reports them and the steps so far, with the answer's text as it is written below it. A question from the AI (ask_person)
 * stops the clock: the run button then says Väntar på ditt svar instead of spinning, and the question is shown first in the panel,
 * marked, scrolled into view and focused. A run that ends without proposing a change says so, with the AI's words and the choice to
 * ask again or change the question. Everything from the AI reaches the page as text only.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/ai-run', ['ui/base', 'ui/basic', 'ui/icons'], (base, basic, icons) => {
    const { h, t, i18n, uid } = base;
    /** How much of the text being written the status shows: its end. */
    const LIVE_CHARS = 280;
    /** The arguments whose short text says what a tool works on (a class, a storey, a name). */
    const DETAIL_ARGS = ['ifc_class', 'class', 'storey', 'name', 'theme', 'heading', 'query', 'title', 'command'];

    /** A tool or command in words: its own text when the app has one, otherwise its name. @param {string} name @param {any} [args] */
    function describeTool(name, args) {
      const key = 'ai.tool.' + String(name || '');
      const what = i18n.has(key) ? t(key) : t('ai.tool.other', { name: String(name || '').slice(0, 60) });
      const a = args && typeof args === 'object' ? args : {};
      const detail = DETAIL_ARGS.map((k) => a[k]).find((v) => typeof v === 'string' && v.trim());
      return detail ? `${what} · ${String(detail).trim().slice(0, 48)}` : what;
    }
    /** Milliseconds as m:ss, or h:mm:ss from an hour. @param {number} ms */
    function clock(ms) {
      const sec = Math.max(0, Math.floor(ms / 1000));
      const two = (n) => String(n).padStart(2, '0');
      const hh = Math.floor(sec / 3600); const mm = Math.floor((sec % 3600) / 60); const ss = sec % 60;
      return hh ? `${hh}:${two(mm)}:${two(ss)}` : `${mm}:${two(ss)}`;
    }

    /**
     * One panel's run: `start` and `stop` around the loop, `event` for its events (ai/agent, ai/assistant), `ask` around the
     * panel's asker, `view` the status line and `button` the run button.
     * @param {{onChange?: () => void}} [options] `onChange` draws the panel again when a question starts or ends waiting
     */
    function create(options = {}) {
      const s = { running: false, waiting: false, phase: 'thinking', what: '', text: '', fresh: true, spent: 0, since: 0, done: { input: 0, output: 0 }, turn: null, steps: 0 };
      const icon = icons.icon('loader-circle', 16);
      const phaseEl = h('span', { class: 'dm-ai-run-phase', role: 'status', 'aria-live': 'polite', 'data-ai-run-phase': '' });
      const metaEl = h('span', { class: 'dm-ai-run-meta', 'data-ai-run-meta': '' });
      const liveEl = h('p', { class: 'dm-ai-run-live', 'data-ai-run-live': '' });
      const el = h('div', { class: 'dm-ai-run', 'data-ai-run': 'idle', hidden: '' }, h('div', { class: 'dm-ai-run-line' }, icon, phaseEl, metaEl), liveEl);
      let ticker = null;
      const elapsed = () => s.spent + (s.running && !s.waiting && s.since ? Date.now() - s.since : 0);
      const changed = () => { if (options.onChange) { try { options.onChange(); } catch (err) { console.error(err); } } };
      function phaseText() {
        if (s.waiting) return t('ai.run.waiting');
        if (s.phase === 'tool') return t('ai.run.tool', { what: s.what });
        if (s.phase === 'calling') return t('ai.run.calling', { what: s.what });
        if (s.phase === 'writing') return t('ai.run.writing');
        return t('ai.run.thinking');
      }
      /** The status drawn again in place: the panel is not drawn again for each piece of text. */
      function paint() {
        el.hidden = !s.running;
        el.setAttribute('data-ai-run', !s.running ? 'idle' : s.waiting ? 'waiting' : s.phase);
        el.classList.toggle('dm-ai-run-waiting', s.waiting);
        icon.setAttribute('name', s.waiting ? 'message-square' : 'loader-circle');
        const phase = phaseText();
        if (phaseEl.textContent !== phase) phaseEl.textContent = phase;
        const input = s.done.input + (s.turn ? s.turn.input : 0); const output = s.done.output + (s.turn ? s.turn.output : 0);
        const bits = [t('ai.run.time', { time: clock(elapsed()) })];
        if (input || output) bits.push(t('ai.run.tokens', { input: i18n.formatNumber(input), output: i18n.formatNumber(output) }));
        if (s.steps) bits.push(t('ai.run.steps', { n: i18n.formatNumber(s.steps) }));
        metaEl.textContent = bits.join(' · ');
        const live = s.text.length > LIVE_CHARS ? '…' + s.text.slice(-LIVE_CHARS) : s.text;
        liveEl.textContent = live;
        liveEl.hidden = !live;
      }
      function start() {
        Object.assign(s, { running: true, waiting: false, phase: 'thinking', what: '', text: '', fresh: true, spent: 0, since: Date.now(), done: { input: 0, output: 0 }, turn: null, steps: 0 });
        clearInterval(ticker);
        ticker = setInterval(paint, 1000);
        paint();
      }
      function stop() {
        if (s.running && !s.waiting) s.spent += Date.now() - s.since;
        s.running = false; s.waiting = false;
        clearInterval(ticker); ticker = null;
        paint();
      }
      /** An event of the loop: thinking, delta (text, tool, usage), tool-start, tool and step (done), usage (the run's total). */
      function event(ev) {
        if (!ev || !s.running) return;
        if (ev.type === 'thinking') { s.phase = 'thinking'; s.what = ''; s.fresh = true; s.turn = null; }
        else if (ev.type === 'delta' && ev.delta) {
          const d = ev.delta;
          if (d.type === 'text') { if (s.fresh) { s.text = ''; s.fresh = false; } s.text += String(d.text || ''); s.phase = 'writing'; }
          else if (d.type === 'tool') { s.phase = 'calling'; s.what = describeTool(d.name); }
          else if (d.type === 'usage') s.turn = { input: Number(d.input) || 0, output: Number(d.output) || 0 };
        } else if (ev.type === 'usage' && ev.usage) { s.done = { input: Number(ev.usage.input) || 0, output: Number(ev.usage.output) || 0 }; s.turn = null; }
        else if (ev.type === 'tool-start') { s.phase = 'tool'; s.what = describeTool(ev.name, ev.args); }
        else if (ev.type === 'tool' || ev.type === 'step') s.steps++;
        paint();
      }
      /**
       * The panel's asker, wrapped: while the question waits the clock stands still and the panel says so.
       * @template T @param {(q: any) => Promise<T>} fn @returns {(q: any) => Promise<T>}
       */
      function ask(fn) {
        return async (q) => {
          if (s.running && !s.waiting) s.spent += Date.now() - s.since;
          s.waiting = true; paint(); changed();
          try { return await fn(q); } finally {
            s.waiting = false; s.since = Date.now(); paint(); changed();
          }
        };
      }
      /**
       * The run button: spinning while the AI works, Väntar på ditt svar (not spinning) while a question waits, when pressed then
       * bringing the question forward. @param {Record<string, any> & {label: string, onClick: Function, focusQuestion?: () => void}} opts
       */
      function button(opts) {
        const { focusQuestion, onClick, ...rest } = opts;
        if (s.waiting) return basic.button(Object.assign({}, rest, { label: t('ai.run.waiting'), icon: 'message-square', loading: false, disabled: false, title: t('ai.run.waiting.hint'), 'data-ai-waiting': '', onClick: () => { if (focusQuestion) focusQuestion(); } }));
        return basic.button(Object.assign({}, rest, { loading: s.running || !!rest.loading, onClick }));
      }
      return { el, start, stop, event, ask, button, view: () => el, paint, get running() { return s.running; }, get waiting() { return s.waiting; }, elapsed, state: s };
    }

    /**
     * A question from the AI (ask_person) with its answers to choose from and, when allowed, a free answer; `resolve` gets the
     * answer or null when the person closes it. Marked as waiting for the person, and focusable so that it can be brought forward.
     * Text only. @param {{question: string, options?: any[], free?: boolean}} q
     * @param {(answer: {answer: string, index: number|null, free: boolean}|null) => void} resolve
     */
    function questionBox(q, resolve) {
      const free = q.free ? /** @type {any} */ (h('dm-input', { label: t('ask.free') })) : null;
      const id = uid('dm-ask');
      return h('div', { class: 'dm-card dm-stack-sm dm-ask dm-ask-pending', 'data-ask': '', role: 'group', tabindex: '-1', 'aria-labelledby': id },
        h('p', { class: 'dm-help dm-xs dm-ask-waiting', text: t('ai.run.question') }),
        h('p', { class: 'dm-ask-question', id, text: String(q.question || '').slice(0, 500) }),
        (q.options || []).slice(0, 6).map((o, i) => h('div', { class: 'dm-stack-sm dm-ask-option', 'data-ask-option': String(i) },
          basic.button({ label: String(o.label).slice(0, 80), title: o.description || o.label, onClick: () => resolve({ answer: o.label, index: i, free: false }) }),
          o.description ? h('p', { class: 'dm-help dm-small', text: String(o.description).slice(0, 200) }) : null)),
        free ? h('div', { class: 'dm-row-wrap dm-ask-free' }, free, basic.button({ label: t('ask.answer'), title: t('ask.answer.hint'), onClick: () => { const v = String(free.value || '').trim().slice(0, 500); if (v) resolve({ answer: v, index: null, free: true }); } })) : null,
        basic.button({ label: t('common.cancel'), variant: 'ghost', size: 'sm', title: t('assistant.question.cancel'), onClick: () => resolve(null) }));
    }
    /** The question brought forward once it is on the page: scrolled into view and focused. @param {Element|null} root */
    function reveal(root) {
      // After the panel's drawing, which puts the box on the page.
      setTimeout(() => {
        const box = /** @type {HTMLElement|null} */ (root && root.querySelector('[data-ask]'));
        if (!box || !box.isConnected) return;
        if (box.scrollIntoView) box.scrollIntoView({ block: 'nearest' });
        box.focus({ preventScroll: true });
      }, 0);
    }

    /**
     * A run that proposed no change: the AI's words, clearly, that nothing was proposed, and the choice to ask again or to change
     * the question. @param {{answer: string, onAgain: () => void, onRefine: () => void}} opts
     */
    function noChanges(opts) {
      return h('div', { class: 'dm-card dm-stack-sm dm-ai-none', 'data-ai-no-changes': '' },
        h('strong', { class: 'dm-small', text: t('ai.none.title') }),
        h('p', { class: 'dm-help dm-xs', text: t('ai.none.hint') }),
        opts.answer ? h('div', { class: 'dm-stack-sm dm-ai-none-answer', 'data-ai-none-answer': '' }, String(opts.answer).split(/\n{2,}/).map((para) => h('p', { class: 'dm-small', text: para }))) : null,
        h('div', { class: 'dm-row-wrap' },
          basic.button({ label: t('ai.none.again'), icon: 'repeat', size: 'sm', title: t('ai.none.again.hint'), 'data-ai-again': '', onClick: opts.onAgain }),
          basic.button({ label: t('ai.none.refine'), icon: 'pencil', size: 'sm', variant: 'ghost', title: t('ai.none.refine.hint'), 'data-ai-refine': '', onClick: opts.onRefine })));
    }
    /** The answer box drawn again with a text, its focus at the end. @param {Element|null} root @param {string} text */
    function refine(root, text) {
      const q = /** @type {any} */ (root && root.querySelector('[data-ai-question]'));
      if (!q) return;
      q.value = text;
      q.dispatchEvent(new Event('input', { bubbles: true }));
      if (q.scrollIntoView) q.scrollIntoView({ block: 'nearest' });
      q.focus();
    }
    return { create, describeTool, clock, questionBox, reveal, noChanges, refine, LIVE_CHARS };
  });
})();
