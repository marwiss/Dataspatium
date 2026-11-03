// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Credentials panel for a connector: enter a key for this session, save it encrypted with a
 * passphrase, unlock saved keys, forget. Shown only for connectors whose auth type needs credentials.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/api/auth-panel', ['ui/base', 'ui/basic', 'ui/overlays', 'api/auth', 'api/secrets'], (base, basic, overlays, auth, secrets) => {
    const { h, t, replace } = base;

    /**
     * @param {any} connector
     * @param {{onChange?: Function, quiet?: boolean}} [hooks] quiet: plain buttons, for views that already have their primary button
     */
    function create(connector, hooks = {}) {
      const main = hooks.quiet ? 'default' : 'primary';
      const el = h('div', { class: 'dm-card dm-stack-sm dm-auth-panel' });
      let editing = false;
      let persisted = false;
      const fields = auth.requiredFields(connector.auth);
      const unsubscribe = secrets.subscribe(() => render());
      secrets.isPersisted(connector.id).then((p) => { persisted = p; render(); });

      async function askPassphrase(title) {
        const input = /** @type {any} */ (h('dm-input', { type: 'password', label: t('api.key.passphrase'), help: t('api.key.passphrase.help') }));
        const ok = await overlays.dialog.open({ title, body: input, actions: [{ label: t('common.cancel'), value: false }, { label: t('common.ok'), variant: 'primary', value: true, primary: true }] });
        setTimeout(() => input.focus(), 0);
        return ok === true ? input.value : null;
      }

      function render() {
        const has = auth.hasCredentials(connector);
        const status = has ? (persisted ? t('api.key.status.saved') : t('api.key.status.session')) : (persisted ? t('api.key.status.locked') : t('api.key.status.missing'));
        const nodes = [h('div', { class: 'dm-row' }, h('strong', { text: t('api.auth') }), h('dm-badge', { kind: has ? 'ok' : 'warn', text: status }))];
        if (connector.auth && connector.auth.help) nodes.push(h('p', { class: 'dm-help', text: connector.auth.help }));
        if (!has && persisted && !editing) nodes.push(h('div', { class: 'dm-row' }, basic.button({ label: t('api.key.unlock'), icon: 'lock', variant: main, onClick: unlock }), basic.button({ label: t('api.key.use'), onClick: () => { editing = true; render(); } })));
        if ((!has && !persisted) || editing) {
          const inputs = fields.map((f) => { const inp = /** @type {any} */ (h('dm-input', { label: f.label, type: f.secret ? 'password' : 'text', autocomplete: 'off' })); const current = secrets.get(connector.id); if (current && current[f.key]) inp.value = current[f.key]; return [f, inp]; });
          const values = () => { const out = {}; for (const [f, inp] of inputs) { out[f.key] = inp.value.trim(); if (!out[f.key]) throw new Error(t('op.missing', { fields: f.label })); } return out; };
          nodes.push(h('div', { class: 'dm-form-grid' }, inputs.map(([, inp]) => inp)));
          nodes.push(h('div', { class: 'dm-row-wrap' },
            basic.button({ label: t('api.key.use'), icon: 'check', variant: main, onClick: () => { try { secrets.set(connector.id, values()); editing = false; render(); if (hooks.onChange) hooks.onChange(); } catch (err) { overlays.toast.show(String(err.message || err), { kind: 'warn' }); } } }),
            basic.button({ label: t('api.key.save'), icon: 'save', onClick: async () => { try { const v = values(); const pass = await askPassphrase(t('api.key.save')); if (pass === null) return; await secrets.persist(connector.id, v, pass); persisted = true; editing = false; render(); overlays.toast.show(t('api.key.saved.toast'), { kind: 'ok' }); if (hooks.onChange) hooks.onChange(); } catch (err) { overlays.toast.show(String(err.message || err), { kind: 'warn' }); } } }),
            editing ? basic.button({ label: t('common.cancel'), variant: 'ghost', onClick: () => { editing = false; render(); } }) : null,
            connector.auth && connector.auth.signupUrl ? basic.button({ label: t('api.key.signup'), icon: 'external-link', variant: 'ghost', onClick: () => window.open(connector.auth.signupUrl, '_blank', 'noopener') }) : null));
          nodes.push(h('p', { class: 'dm-help', text: t('api.key.help') }));
        } else if (has) {
          nodes.push(h('div', { class: 'dm-row-wrap' },
            basic.button({ label: t('api.key.change'), size: 'sm', onClick: () => { editing = true; render(); } }),
            basic.button({ label: t('api.key.forget'), size: 'sm', variant: 'ghost', icon: 'trash-2', onClick: async () => { await secrets.forget(connector.id); persisted = false; auth.clearToken(connector.id); render(); if (hooks.onChange) hooks.onChange(); } })));
        }
        replace(el, nodes);
      }
      async function unlock() {
        const pass = await askPassphrase(t('api.key.unlock'));
        if (pass === null) return;
        try { const n = await secrets.unlock(pass); overlays.toast.show(t('api.key.unlocked', { n }), { kind: 'ok' }); render(); if (hooks.onChange) hooks.onChange(); } catch (err) { overlays.toast.show(String(err.message || err), { kind: 'error' }); }
      }
      render();
      return { el, destroy: unsubscribe, render };
    }
    return { create };
  });
})();
