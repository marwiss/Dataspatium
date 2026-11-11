// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * A question to the person with a few answers to choose from, and optionally one of their own (decision F34 a). Flows ask with it
 * (the step `ask`), and so will the AI in the app. Everything in it is text from a flow or an AI, so it is shown as text only, cut to
 * its limits; an answer here never approves anything, which the app's own dialogs do.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/ask', ['ui/base', 'ui/basic', 'ui/overlays'], (base, basic, overlays) => {
    const { h, t } = base;
    const MAX_QUESTION = 500;
    const MAX_LABEL = 80;
    const MAX_DESCRIPTION = 200;
    const MAX_OPTIONS = 6;
    const cut = (s, n) => { const v = String(s || '').trim(); return v.length > n ? v.slice(0, n - 1) + '…' : v; };

    /**
     * Asks and waits for the answer.
     * @param {{question: string, options?: Array<{label: string, description?: string}>, free?: boolean, title?: string, signal?: AbortSignal}} q
     * @returns {Promise<{answer: string, index: number|null, free: boolean}|null>} null when the person closes the question
     */
    function ask(q) {
      const options = (q.options || []).slice(0, MAX_OPTIONS).map((o) => ({ label: cut(o.label, MAX_LABEL), description: cut(o.description, MAX_DESCRIPTION) })).filter((o) => o.label);
      let close = null;
      const asked = overlays.dialog.open({
        title: q.title ? cut(q.title, MAX_LABEL) : t('ask.title'),
        actions: [{ label: t('common.cancel'), value: null }],
        body: (done) => {
          close = done;
          const free = q.free ? /** @type {any} */ (h('dm-input', { label: t('ask.free') })) : null;
          return h('div', { class: 'dm-stack dm-ask', 'data-ask': '' },
            h('p', { class: 'dm-ask-question', text: cut(q.question, MAX_QUESTION) }),
            h('div', { class: 'dm-stack-sm' }, options.map((o, i) => h('div', { class: 'dm-stack-sm dm-ask-option', 'data-ask-option': String(i) },
              basic.button({ label: o.label, title: o.description || o.label, onClick: () => done({ answer: o.label, index: i, free: false }) }),
              o.description ? h('p', { class: 'dm-help dm-small', text: o.description }) : null))),
            free ? h('div', { class: 'dm-row-wrap dm-ask-free' }, free,
              basic.button({ label: t('ask.answer'), title: t('ask.answer.hint'), onClick: () => { const v = cut(free.value, MAX_QUESTION); if (v) done({ answer: v, index: null, free: true }); } })) : null);
        },
      });
      if (q.signal) q.signal.addEventListener('abort', () => { if (close) close(null); }, { once: true });
      return asked.then((v) => (v && typeof v === 'object' ? v : null));
    }
    return { ask, MAX_QUESTION, MAX_LABEL, MAX_DESCRIPTION, MAX_OPTIONS };
  });
})();
