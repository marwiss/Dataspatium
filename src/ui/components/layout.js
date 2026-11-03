// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Layout components: dm-tabs, dm-panel, dm-empty-state, dm-stepper, dm-kv.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/layout', ['ui/base', 'ui/icons'], (base, icons) => {
    const { h, DmElement, define, replace } = base;

    /**
     * Keyboard focus for the active tab when the tabs are drawn anew right after a key press (modes often
     * rebuild their tabs on dm-change): {key: the tab ids, id, source: the element that had focus, at}.
     */
    let refocus = null;

    /**
     * <dm-tabs> with `tabs = [{id, label, icon?}]` and `active`; emits `dm-change` {id}. Arrow keys, Home and
     * End move between the tabs and keep the keyboard focus on the active one.
     */
    class DmTabs extends DmElement {
      connectedCallback() {
        if (!this.list) { this.list = h('div', { role: 'tablist' }); this.appendChild(this.list); this.list.addEventListener('keydown', (e) => this.onKey(e)); }
        this.render();
      }
      set tabs(list) { this._tabs = list; if (this.list) this.render(); }
      get tabs() { return this._tabs || []; }
      get active() { return this._active || (this.tabs[0] && this.tabs[0].id) || null; }
      set active(id) { this._active = id; if (this.list) this.render(); }
      select(id, emit = true) { this._active = id; this.render(); if (emit) this.emit('dm-change', { id }); }
      focusActive() { const b = this.list && this.list.querySelector('[aria-selected="true"]'); if (b) /** @type {HTMLElement} */ (b).focus(); }
      onKey(e) {
        const ids = this.tabs.map((t) => t.id); const i = ids.indexOf(this.active);
        const next = e.key === 'ArrowRight' ? ids[(i + 1) % ids.length] : e.key === 'ArrowLeft' ? ids[(i - 1 + ids.length) % ids.length]
          : e.key === 'Home' ? ids[0] : e.key === 'End' ? ids[ids.length - 1] : null;
        if (next === null || next === undefined) return;
        e.preventDefault();
        refocus = { key: ids.join('\u0000'), id: next, source: this, at: Date.now() };
        this.select(next);
        // Still in the page: nobody rebuilt the tabs, so the focus stays here.
        if (this.isConnected) { refocus = null; this.focusActive(); }
      }
      render() {
        const active = this.active;
        replace(this.list, this.tabs.map((t) => h('button', {
          role: 'tab', type: 'button', 'aria-selected': t.id === active ? 'true' : 'false', tabindex: t.id === active ? '0' : '-1',
          onclick: () => this.select(t.id),
        }, t.icon ? icons.icon(t.icon, 14) : null, t.label)));
        const r = refocus;
        if (r && r.source !== this && r.id === active && Date.now() - r.at < 2000 && r.key === this.tabs.map((t) => t.id).join('\u0000')) {
          refocus = null;
          setTimeout(() => { if (this.isConnected) this.focusActive(); }, 0);
        }
      }
    }
    define('dm-tabs', DmTabs);

    /**
     * <dm-panel heading="Rubrik" card>…children…<x slot="actions"/></dm-panel>
     */
    class DmPanel extends DmElement {
      static get observedAttributes() { return ['heading']; }
      connectedCallback() {
        if (!this.body) {
          const actions = Array.from(this.children).filter((c) => c.getAttribute('slot') === 'actions');
          this.titleEl = h('h3', { text: this.attr('heading') });
          this.actionsEl = h('div', { class: 'dm-row' }, actions);
          this.head = h('div', { class: 'dm-panel-head' }, this.titleEl, this.actionsEl);
          this.body = h('div', { class: 'dm-panel-body' });
          while (this.firstChild) this.body.appendChild(this.firstChild);
          this.append(this.head, this.body);
          this.head.hidden = !this.getAttribute('heading') && actions.length === 0;
        }
      }
      attributeChangedCallback() { if (this.titleEl) { this.titleEl.textContent = this.attr('heading'); this.head.hidden = false; } }
      /** Replace body content. */
      set content(nodes) { replace(this.body, nodes); }
      get bodyEl() { return this.body; }
    }
    define('dm-panel', DmPanel);

    /**
     * <dm-empty-state icon="database" heading="…" text="…">actions…</dm-empty-state>
     */
    class DmEmptyState extends DmElement {
      connectedCallback() {
        if (this.built) return;
        this.built = true;
        const actions = Array.from(this.childNodes);
        const icon = this.getAttribute('icon');
        replace(this,
          icon ? icons.icon(icon, 40) : null,
          h('h2', { text: this.attr('heading') }),
          this.getAttribute('text') ? h('p', { text: this.attr('text') }) : null,
          actions.length ? h('div', { class: 'dm-empty-actions' }, actions) : null,
        );
      }
    }
    define('dm-empty-state', DmEmptyState);

    /**
     * <dm-stepper> with `steps = [{id, label}]` and `active` id.
     */
    class DmStepper extends DmElement {
      connectedCallback() { this.render(); }
      set steps(list) { this._steps = list; this.render(); }
      get steps() { return this._steps || []; }
      set active(id) { this._active = id; this.render(); }
      get active() { return this._active; }
      render() {
        if (!this.isConnected) return;
        const ids = this.steps.map((s) => s.id); const current = ids.indexOf(this._active);
        const nodes = [];
        this.steps.forEach((s, i) => {
          if (i > 0) nodes.push(h('span', { class: 'dm-step-sep', 'aria-hidden': 'true' }));
          const done = current > i;
          nodes.push(h('span', { class: 'dm-step', 'aria-current': i === current ? 'step' : null, 'data-done': done ? '' : null },
            h('span', { class: 'dm-step-index' }, done ? icons.icon('check', 12) : String(i + 1)), h('span', { text: s.label })));
        });
        replace(this, nodes);
      }
    }
    define('dm-stepper', DmStepper);

    /**
     * <dm-kv> definition list with `items = [{label, value}]` (value may be a Node).
     */
    class DmKv extends DmElement {
      connectedCallback() { this.render(); }
      set items(list) { this._items = list; this.render(); }
      get items() { return this._items || []; }
      render() {
        if (!this.isConnected) return;
        replace(this, this.items.flatMap((it) => [h('dt', { text: it.label }), h('dd', null, it.value instanceof Node ? it.value : (it.value === null || it.value === undefined || it.value === '' ? h('span', { class: 'dm-faint', text: '–' }) : String(it.value)))]));
      }
    }
    define('dm-kv', DmKv);

    return { DmTabs, DmPanel, DmEmptyState, DmStepper, DmKv };
  });
})();
