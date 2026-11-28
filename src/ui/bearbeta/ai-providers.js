// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * The AI providers' dialog, shared by every AI panel (the model's, the plan's and the AI assistant): the list of providers with
 * where each key is, and a provider's form (B-83). The model is chosen from the kind's own list, the server's list fetched on the
 * person's press (Hämta modellistan) or written in (Annan modell …). The key is written, never shown: it is kept for this session
 * or stored encrypted with the passphrase (api/secrets), the form says which of session, stored and unlocked, stored and locked
 * (with Lås upp) or missing, and Pröva nyckeln makes the cheapest real call and says OK or what to do. Every call to the provider
 * waits for the person's press and the consent for its host. The panels' notice of a missing or locked key and their choice of
 * model come from here too.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/bearbeta/ai-providers', ['ui/base', 'ui/basic', 'ui/overlays', 'ai/providers'], (base, basic, overlays, providers) => {
    const { h, t, i18n } = base;
    const OTHER = '\u0000other';
    const KEEPS = ['session', 'saved'];
    const BADGE = { session: 'ok', saved: 'ok', locked: 'warn', local: 'accent', missing: 'warn' };
    const errText = (err) => String((err && err.message) || err);

    /** The badge of a key's state. @param {string} state */
    const keyBadge = (state) => h('dm-badge', { kind: BADGE[state] || 'warn', 'data-ai-key-state': state, text: t('ai.key.state.' + state) });

    /** The passphrase of the stored keys, asked in a dialog of its own; null when the person closes it. @param {string} title */
    async function askPassphrase(title) {
      const input = /** @type {any} */ (h('dm-input', { type: 'password', label: t('api.key.passphrase'), help: t('api.key.passphrase.help'), autocomplete: 'off', 'data-ai-passphrase': '' }));
      setTimeout(() => input.focus(), 0);
      const ok = await overlays.dialog.open({ title, body: input, actions: [{ label: t('common.cancel'), value: false }, { label: t('common.ok'), variant: 'primary', value: true, primary: true }] });
      return ok === true ? String(input.value || '') : null;
    }
    /** Unlocks the stored keys with the passphrase; says how many, or why not. @returns {Promise<boolean>} */
    async function unlock() {
      const pass = await askPassphrase(t('api.key.unlock'));
      if (pass === null) return false;
      try { const n = await providers.unlockKeys(pass); overlays.toast.show(t('api.key.unlocked', { n }), { kind: 'ok' }); return true; } catch (err) { overlays.toast.show(errText(err), { kind: 'error' }); return false; }
    }

    /**
     * A panel's view of where the chosen provider's key is, kept up to date: `refresh` reads it again (true when it changed), a
     * change of the keys (set, stored, locked, unlocked) calls `onChange` when it changed, and `destroy` stops listening.
     * @param {() => any} provider the chosen provider, or null @param {() => void} onChange
     */
    function keyWatch(provider, onChange) {
      const w = {
        state: 'missing',
        async refresh() {
          const p = provider();
          const next = p ? await providers.keyState(p) : 'missing';
          const changed = next !== w.state;
          w.state = next;
          return changed;
        },
        destroy: () => {},
      };
      w.destroy = providers.subscribeKeys(() => { w.refresh().then((changed) => { if (changed) onChange(); }); });
      return w;
    }
    /**
     * The panels' notice about the chosen provider's key: missing, or stored and locked with Lås upp; nothing when the key is there
     * or not needed. @param {any} provider @param {string} state from providers.keyState @param {() => void} [onUnlocked]
     */
    function keyNotice(provider, state, onUnlocked) {
      if (!provider || (state !== 'missing' && state !== 'locked')) return null;
      if (state === 'missing') return h('p', { class: 'dm-help dm-xs', 'data-ai-key-notice': 'missing', text: t('ai.key.missing', { name: provider.name }) });
      return h('div', { class: 'dm-row-wrap', 'data-ai-key-notice': 'locked' },
        h('p', { class: 'dm-help dm-xs dm-grow', text: t('ai.key.locked', { name: provider.name }) }),
        basic.button({ label: t('api.key.unlock'), icon: 'lock', size: 'sm', title: t('ai.key.unlock.hint'), 'data-ai-unlock': '', onClick: async () => { if (await unlock() && onUnlocked) onUnlocked(); } }));
    }

    /**
     * The panel's choice of the chosen provider's model: the provider's list (providers.modelsFor) and Annan modell …; a choice is
     * kept with the provider. @param {any} provider @param {(err: any) => void} fail
     */
    function modelSelect(provider, fail) {
      const sel = /** @type {any} */ (h('dm-select', { label: t('ai.model'), title: t('ai.model.hint'), 'data-ai-model': '' }));
      if (!provider) return null;
      sel.options = providers.modelsFor(provider).map((m) => ({ value: m, label: m })).concat([{ value: OTHER, label: t('ai.model.other') }]);
      sel.value = provider.model;
      sel.addEventListener('change', async () => {
        let model = sel.value;
        if (model === OTHER) {
          model = await overlays.dialog.prompt(t('ai.model.own'), { title: t('ai.model.other'), value: provider.model });
          if (model === null || !String(model).trim()) { sel.value = provider.model; return; }
        }
        try { await providers.setModel(provider.id, String(model).trim()); } catch (err) { fail(err); }
      });
      return sel;
    }

    /** The dialog that lists the providers with where their keys are, and adds, changes or removes one. */
    async function manage(_ctx) {
      for (;;) {
        const all = await providers.list();
        const states = await Promise.all(all.map((p) => providers.keyState(p)));
        let done = () => {};
        const rows = all.map((p, i) => h('div', { class: 'dm-row', 'data-ai-provider': p.id },
          h('span', { class: 'dm-grow dm-small', text: `${p.name} · ${t('ai.kind.' + p.kind)} · ${p.model} · ${providers.hostOf(p.baseUrl)}` }),
          keyBadge(states[i]),
          basic.button({ label: t('common.edit'), size: 'sm', title: t('ai.providers.edit.hint'), onClick: () => done({ edit: p }) }),
          basic.button({ label: t('ai.providers.remove'), size: 'sm', variant: 'ghost', title: t('ai.providers.remove.hint'), onClick: () => done({ remove: p }) })));
        const locked = states.includes('locked');
        const chosen = await overlays.dialog.open({
          title: t('ai.providers.title'),
          help: 'cad-bim#nyckeln-och-modellen',
          body: (finish) => { done = finish; return h('div', { class: 'dm-stack-sm' }, h('p', { class: 'dm-help', text: t('ai.providers.hint') }), rows.length ? rows : h('p', { class: 'dm-help', text: t('ai.providers.none') }),
            locked ? basic.button({ label: t('api.key.unlock'), icon: 'lock', size: 'sm', title: t('ai.key.unlock.hint'), 'data-ai-unlock': '', onClick: () => finish({ unlock: true }) }) : null); },
          actions: [{ label: t('common.close'), value: null }, { label: t('ai.providers.add'), variant: 'primary', value: 'add', primary: true }],
        });
        if (!chosen) return;
        if (chosen === 'add') await edit(null);
        else if (chosen.unlock) await unlock();
        else if (chosen.edit) await edit(chosen.edit);
        else if (chosen.remove) { if (await overlays.dialog.confirm(t('ai.providers.remove.confirm', { name: chosen.remove.name }), { danger: true })) await providers.remove(chosen.remove.id); }
      }
    }

    /**
     * One provider's form: a preset to start from, then kind, name, address, model and key. The key is never shown again; the form
     * says where it is kept and can try it. @param {any} existing @returns {Promise<any>} the saved provider, or null
     */
    async function edit(existing) {
      const values = Object.assign({ kind: 'anthropic', name: '', baseUrl: providers.KINDS.anthropic.baseUrl, model: providers.KINDS.anthropic.model, models: undefined }, existing || {});
      let error = '';
      let keep = existing && (await providers.keyState(existing)) === 'saved' ? 'saved' : 'session';
      for (;;) {
        const state = existing ? await providers.keyState(existing) : 'missing';
        const preset = /** @type {any} */ (h('dm-select', { label: t('ai.preset') }));
        preset.options = [{ value: '', label: t('ai.preset.own') }].concat(providers.PRESETS.map((p) => ({ value: p.id, label: t(p.nameKey) })));
        preset.value = '';
        const kind = /** @type {any} */ (h('dm-select', { label: t('ai.kind') }));
        kind.options = Object.keys(providers.KINDS).map((k) => ({ value: k, label: t(providers.KINDS[k].labelKey) }));
        kind.value = values.kind;
        const name = /** @type {any} */ (h('dm-input', { label: t('ai.name'), value: values.name }));
        const baseUrl = /** @type {any} */ (h('dm-input', { label: t('ai.baseUrl'), value: values.baseUrl, placeholder: 'https://…' }));
        // The model: the kind's list, the server's once fetched, and a name of one's own.
        const model = /** @type {any} */ (h('dm-select', { label: t('ai.model'), 'data-ai-form-model': '' }));
        const own = /** @type {any} */ (h('dm-input', { label: t('ai.model.own'), 'data-ai-form-model-own': '' }));
        const form = () => ({ id: existing ? existing.id : undefined, kind: kind.value, name: String(name.value || '').trim() || providers.hostOf(baseUrl.value), baseUrl: String(baseUrl.value || '').trim(), model: chosenModel(), models: values.models });
        const fillModels = (wanted) => {
          const list = providers.modelsFor({ kind: kind.value, baseUrl: baseUrl.value, models: values.models, model: '' });
          const pick = wanted && list.includes(wanted) ? wanted : wanted ? OTHER : list[0] || OTHER;
          model.options = list.map((m) => ({ value: m, label: m })).concat([{ value: OTHER, label: t('ai.model.other') }]);
          model.value = pick;
          own.value = pick === OTHER ? wanted || '' : '';
          own.hidden = pick !== OTHER;
        };
        const chosenModel = () => (model.value === OTHER ? String(own.value || '').trim() : model.value);
        fillModels(values.model);
        // Whether an OpenAI-compatible model sees pictures (F139 a): preset from the model's name until the person sets it; Claude
        // always does, so the switch shows only for the other kind.
        const images = /** @type {any} */ (h('dm-switch', { label: t('ai.images'), title: t('ai.images.hint'), 'data-ai-form-images': '' }));
        const imagesByName = () => providers.seesByName(chosenModel());
        const showImages = () => { images.hidden = kind.value === 'anthropic'; if (typeof values.images !== 'boolean') images.checked = imagesByName(); };
        images.checked = typeof values.images === 'boolean' ? values.images : imagesByName();
        images.addEventListener('change', () => { values.images = !!images.checked; });
        showImages();
        model.addEventListener('change', () => { own.hidden = model.value !== OTHER; if (!own.hidden) own.focus(); showImages(); });
        own.addEventListener('input', showImages);
        kind.addEventListener('change', () => { fillModels(providers.KINDS[kind.value] ? providers.KINDS[kind.value].model : ''); showImages(); });
        preset.addEventListener('change', () => { const p = providers.PRESETS.find((x) => x.id === preset.value); if (!p) return; kind.value = p.kind; name.value = t(p.nameKey); baseUrl.value = p.baseUrl; values.models = undefined; fillModels(p.model); showImages(); });
        const status = h('p', { class: 'dm-help dm-xs', 'data-ai-form-status': '', role: 'status', 'aria-live': 'polite' });
        const say = (text, kindOf) => { status.textContent = text; status.className = kindOf === 'error' ? 'dm-error dm-small' : kindOf === 'ok' ? 'dm-small' : 'dm-help dm-xs'; status.setAttribute('data-ai-form-status', kindOf || ''); };
        const key = /** @type {any} */ (h('dm-input', { label: t('ai.key'), type: 'password', autocomplete: 'off', help: t('ai.key.hint'), placeholder: state === 'session' || state === 'saved' ? t('ai.key.kept') : '', 'data-ai-form-key': '' }));
        const keepSel = basic.select(t('ai.key.keep'), KEEPS.map((k) => ({ value: k, label: t('ai.key.keep.' + k) })), keep, (v) => { keep = KEEPS.includes(v) ? v : 'session'; }, { title: t('ai.key.keep.hint'), 'data-ai-form-keep': '' });
        const fetchModels = basic.button({ label: t('ai.model.fetch'), icon: 'refresh-cw', size: 'sm', title: t('ai.model.fetch.hint'), 'data-ai-fetch-models': '', onClick: async () => {
          const wanted = chosenModel();
          fetchModels.setAttribute('loading', ''); say(t('ai.model.fetching'));
          try {
            const got = await providers.fetchModels(form(), { key: String(key.value || '') });
            values.models = got;
            fillModels(wanted);
            say(got.length ? t('ai.model.fetched', { n: i18n.formatNumber(got.length) }) : t('ai.model.fetched.none'), got.length ? 'ok' : '');
          } catch (err) { say(errText(err), 'error'); }
          fetchModels.removeAttribute('loading');
        } });
        const test = basic.button({ label: t('ai.key.test'), icon: 'key-round', size: 'sm', title: t('ai.key.test.hint'), 'data-ai-test-key': '', onClick: async () => {
          test.setAttribute('loading', ''); say(t('ai.key.testing'));
          try { const r = await providers.testKey(form(), { key: String(key.value || '') }); say(r.message, r.ok ? 'ok' : 'error'); } catch (err) { say(errText(err), 'error'); }
          test.removeAttribute('loading');
        } });
        const again = (fn) => async () => { if (await fn()) done('again'); };
        let done = () => {};
        const keyRow = h('div', { class: 'dm-row-wrap' },
          test,
          state === 'locked' ? basic.button({ label: t('api.key.unlock'), icon: 'lock', size: 'sm', title: t('ai.key.unlock.hint'), 'data-ai-unlock': '', onClick: again(unlock) }) : null,
          existing && state !== 'missing' && state !== 'local' ? basic.button({ label: t('api.key.forget'), icon: 'trash-2', size: 'sm', variant: 'ghost', title: t('ai.key.forget.hint'), 'data-ai-forget-key': '', onClick: again(async () => { await providers.forgetKey(existing.id); return true; }) }) : null);
        const body = (finish) => {
          done = finish;
          return h('div', { class: 'dm-stack-sm' }, existing ? null : preset, kind, name, baseUrl,
            h('div', { class: 'dm-row-wrap dm-ai-model-row' }, model, fetchModels), own, images,
            h('div', { class: 'dm-row' }, h('strong', { class: 'dm-small dm-grow', text: t('ai.key') }), keyBadge(state)),
            key, keepSel, keyRow, status, error ? h('p', { class: 'dm-error', 'data-ai-form-error': '', text: error }) : null);
        };
        const ok = await overlays.dialog.open({ title: existing ? t('ai.providers.edit') : t('ai.providers.add'), help: 'cad-bim#nyckeln-och-modellen', body, actions: [{ label: t('common.cancel'), value: false }, { label: t('common.save'), variant: 'primary', value: true, primary: true }] });
        Object.assign(values, { kind: kind.value, name: name.value, baseUrl: baseUrl.value, model: chosenModel() });
        if (ok === 'again') { error = ''; continue; }
        if (ok !== true) return null;
        let saved;
        try { saved = await providers.save(values); } catch (err) { error = errText(err); continue; }
        // Saved from here on: a wrong passphrase comes back to the same provider, never to a new one.
        values.id = saved.id; existing = saved;
        try {
          const message = await keepKey(saved, String(key.value || ''), keep);
          if (message) overlays.toast.show(message, { kind: 'ok', timeout: 7000 });
          return saved;
        } catch (err) { error = errText(err); }
      }
    }
    /**
     * The key kept as the person chose: for the session, or stored encrypted (also a key already given in this session); a stored
     * key the person now keeps for the session only is no longer stored. Returns the confirmation to show, or '' when nothing
     * changed. @param {any} saved @param {string} typed @param {string} keep
     */
    async function keepKey(saved, typed, keep) {
      const before = await providers.keyState(saved);
      if (keep === 'saved' && (typed || before === 'session')) {
        const pass = await askPassphrase(t('api.key.save'));
        if (pass === null) { if (typed) providers.setKey(saved.id, typed); return typed ? t('ai.key.done.session', { name: saved.name }) : ''; }
        await providers.saveKey(saved.id, typed || null, pass).catch((err) => { if (typed) providers.setKey(saved.id, typed); throw err; });
        return t('ai.key.done.saved', { name: saved.name });
      }
      if (keep === 'session' && before === 'saved') {
        await providers.unstoreKey(saved.id);
        if (typed) providers.setKey(saved.id, typed);
        return t('ai.key.done.session', { name: saved.name });
      }
      if (!typed) return '';
      providers.setKey(saved.id, typed);
      return t('ai.key.done.session', { name: saved.name });
    }
    return { manage, edit, keyBadge, keyNotice, keyWatch, modelSelect, unlock, askPassphrase, OTHER };
  });
})();
