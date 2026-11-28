// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Mobilen in Inhämta (F129 a): everything that comes from the phone. Two tabs: Para och ta emot, Dela's panel for devices
 * (ui/share/devices) in its receiving form, where the phone is paired and what it sends arrives (collected rows as a new version
 * of the dataset, their photos as an image collection, files imported as usual); and Insamling i fält (ui/field/field-view), the
 * form the phone fills in. A form sent from there waits for the phone in Para och ta emot. The panel for devices is in the group
 * 'dela', loaded at the first opening; nothing connects before the person asks for it.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/field/mobile-source', ['ui/base', 'ui/field/field-view'], (base, fieldView) => {
    const { h, t, replace } = base;
    const TABS = ['receive', 'field'];
    const TAB_ICONS = { receive: 'qr-code', field: 'list-checks' };

    /** @param {any} ctx the mode context */
    function create(ctx) {
      const { ui, shell } = ctx;
      let tab = 'receive';
      /** @type {{center: HTMLElement, right: HTMLElement}|null} */ let target = null;
      /** @type {any} */ let devices = null;
      /** @type {Promise<any>|null} */ let devicesLoading = null;
      /** @type {any} */ let field = null;
      let alive = true;

      /** The panel for devices, created once while the view lives (it keeps the connection between the tabs). */
      function devicesPanel() {
        if (!devicesLoading) {
          devicesLoading = D.ensure(['dela']).then(() => D.require('ui/share/devices').create(ctx, { receive: true })).then((panel) => {
            if (!alive) { panel.destroy(); return null; }
            devices = panel;
            return panel;
          });
          devicesLoading.catch((err) => { devicesLoading = null; shell.partFailed(err); });
        }
        return devicesLoading;
      }

      function draw() {
        if (!target || !alive) return;
        const tabs = /** @type {any} */ (h('dm-tabs'));
        tabs.tabs = TABS.map((id) => ({ id, label: t(id === 'field' ? 'field.source' : 'import.mobile.tab.receive'), icon: TAB_ICONS[id] }));
        tabs.active = tab;
        tabs.addEventListener('dm-change', (e) => { setTab(/** @type {CustomEvent} */ (e).detail.id); });
        const body = h('div', { class: 'dm-stack', 'data-mobile-tab': tab });
        replace(target.center,
          h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon('smartphone', 20), t('import.sources.mobile'))),
          h('p', { class: 'dm-help', 'data-mobile-lead': '', text: t('import.mobile.lead') }),
          tabs, body);
        if (tab === 'field') {
          if (!field) field = fieldView.create(ctx, { embedded: true, onSend: () => setTab('receive') });
          field.render({ center: body, right: target.right }).catch((err) => ui.toast.show(String((err && err.message) || err), { kind: 'error' }));
          return;
        }
        replace(target.right, h('h4', { text: t('import.sources.mobile') }), h('ol', { class: 'dm-stack-xs' }, ['1', '2', '3', '4'].map((n) => h('li', { class: 'dm-help', text: t('import.mobile.steps.' + n) }))));
        if (devices) { devices.render(); replace(body, devices.el); return; }
        replace(body, h('p', { class: 'dm-help', text: t('common.loading') }));
        devicesPanel().then((panel) => { if (panel && alive && tab === 'receive') draw(); }, () => {});
      }
      /** @param {string} id */
      function setTab(id) {
        if (!TABS.includes(id) || !alive) return;
        if (tab === 'field' && id !== 'field' && field) { field.destroy(); field = null; }
        tab = id;
        draw();
      }

      return {
        /** @param {{center: HTMLElement, right: HTMLElement}} slots */
        render(slots) { target = slots; draw(); },
        setTab,
        get tab() { return tab; },
        get devices() { return devices; },
        get field() { return field; },
        destroy() {
          alive = false; target = null;
          if (field) { field.destroy(); field = null; }
          if (devices) { devices.destroy(); devices = null; }
        },
      };
    }
    return { create, TABS };
  });
})();
