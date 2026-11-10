// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Settings cards for the workspace view in Hantera: Internetåtkomst (one consent per purpose and the network calls
 * of this session) and Komponenter (what has been fetched on demand, with sizes, and removal).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/settings/network', ['ui/base', 'platform/consent', 'platform/components'], (base, consent, components) => {
    const { h, t, i18n, replace } = base;
    const STATES = ['ask', 'granted', 'denied'];

    /** @param {any} ctx @param {() => void} rerender */
    async function networkCard(ctx, rerender) {
      const { ui, shell } = ctx;
      const states = await consent.all();
      const rows = consent.PURPOSES.map((p) => {
        const sel = /** @type {any} */ (h('dm-select', { label: t('consent.purpose.' + p), help: t('consent.purpose.' + p + '.body'), disabled: consent.override() ? true : null }));
        sel.options = STATES.map((s) => ({ value: s, label: t('consent.state.' + s) }));
        sel.value = states[p] || 'ask';
        sel.addEventListener('change', async () => {
          try { await consent.set(p, sel.value === 'ask' ? null : sel.value); shell.log(t('consent.changed', { purpose: t('consent.purpose.' + p), state: t('consent.state.' + sel.value) }), 'ok'); }
          catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
        });
        return sel;
      });
      const logEl = h('div', { class: 'dm-stack-sm' });
      const fillLog = () => {
        const entries = (D.net && D.net.log ? D.net.log() : []).slice(-15).reverse();
        if (!entries.length) { replace(logEl, h('p', { class: 'dm-help', text: t('consent.log.empty') })); return; }
        replace(logEl, h('table', { class: 'dm-columns-table' },
          h('thead', null, h('tr', null, h('th', { text: t('consent.log.time') }), h('th', { text: t('consent.log.request') }), h('th', { class: 'dm-num', text: t('consent.log.status') }), h('th', { class: 'dm-num', text: 'ms' }))),
          h('tbody', null, entries.map((e) => h('tr', null,
            h('td', { text: new Date(e.at).toTimeString().slice(0, 8) }),
            h('td', { class: 'dm-truncate', title: e.url, text: `${e.method} ${e.url.length > 70 ? e.url.slice(0, 67) + '…' : e.url}` }),
            h('td', { class: 'dm-num', text: e.status === null ? '…' : String(e.status) }),
            h('td', { class: 'dm-num', text: e.ms === null ? '' : i18n.formatNumber(e.ms) }))))));
      };
      fillLog();
      // The bridge as a go-between (F14.1): off until the user turns it on; the bridge decides which hosts it reaches.
      const bridge = D.require('api/bridge');
      const relay = /** @type {any} */ (h('dm-switch', { label: t('bridge.relay'), title: t('bridge.relay.hint'), 'data-bridge-relay': '' }));
      relay.checked = await bridge.relayEnabled();
      relay.addEventListener('change', async () => {
        await bridge.setRelay(!!relay.checked);
        shell.log(t(relay.checked ? 'bridge.relay.on' : 'bridge.relay.off'), 'ok');
      });
      return h('div', { class: 'dm-card dm-stack', 'data-settings': 'network' },
        h('h3', null, ui.icon('wifi', 18), ' ', t('consent.settings.title')),
        h('p', { class: 'dm-help', text: t('consent.settings.hint') }),
        consent.override() ? h('p', { class: 'dm-warn dm-small', text: t('consent.override') }) : null,
        h('div', { class: 'dm-form-grid' }, rows),
        h('div', { class: 'dm-stack-sm' }, relay, h('p', { class: 'dm-help dm-small', text: t('bridge.relay.help') })),
        h('div', { class: 'dm-row' }, h('h4', { class: 'dm-grow', text: t('consent.log.title') }), ui.button({ label: t('consent.log.refresh'), icon: 'refresh-cw', size: 'sm', variant: 'ghost', onClick: fillLog })),
        logEl);
    }

    /** @param {any} ctx @param {() => void} rerender */
    async function componentsCard(ctx, rerender) {
      const { ui, shell } = ctx;
      const list = await components.list();
      const total = list.reduce((n, m) => n + (m.size || 0), 0);
      const rows = list.map((m) => h('div', { class: 'dm-row', 'data-component': m.id },
        h('span', { class: 'dm-grow dm-truncate' }, h('strong', { text: m.label || m.id }), m.version ? ' ' + m.version : '', h('span', { class: 'dm-help', text: ' · ' + i18n.formatBytes(m.size || 0) + ' · ' + t('components.fetched', { when: i18n.formatDateTime(m.fetchedAt), host: consent.hostOf(m.source) }) })),
        ui.button({ label: t('components.remove'), icon: 'trash-2', size: 'sm', variant: 'ghost', onClick: async () => {
          try { await components.remove(m.id); shell.log(t('components.removed', { label: m.label || m.id }), 'ok'); rerender(); } catch (err) { ui.toast.show(String((err && err.message) || err), { kind: 'error' }); }
        } })));
      return h('div', { class: 'dm-card dm-stack', 'data-settings': 'components' },
        h('h3', null, ui.icon('package', 18), ' ', t('components.title')),
        h('p', { class: 'dm-help', text: t('components.hint') }),
        rows.length ? h('div', { class: 'dm-stack-sm' }, rows) : h('p', { class: 'dm-help', text: t('components.empty') }),
        rows.length ? h('p', { class: 'dm-help', text: t('components.total', { size: i18n.formatBytes(total) }) }) : null);
    }

    return { networkCard, componentsCard };
  });
})();
