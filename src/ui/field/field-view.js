// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Insamling i fält in Inhämta: choose a dataset (or start an empty one), decide which columns the phone asks for, with
 * labels, choices, position and photos, and send the form to Dataspatium Mobil. The form is kept in the dataset. What
 * leaves the computer is shown first: columns, labels, choices and rules, never rows.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/field/field-view', ['ui/base', 'data/datasets', 'data/field-collect'], (base, datasets, collect) => {
    const { h, t, i18n, replace } = base;
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const MAX_CHOICES = 200;

    /** Choices as the user edits them: one per line, "code = label" or just the value. */
    function optionsText(options) {
      return (options || []).map((o) => (String(o.label) === String(o.value) || o.label === undefined ? String(o.value) : `${o.value} = ${o.label}`)).join('\n');
    }
    /** @param {string} text @param {string} type */
    function parseOptions(text, type) {
      const numeric = type === 'integer' || type === 'number';
      return String(text || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
        const at = line.indexOf('=');
        const value = (at > 0 ? line.slice(0, at) : line).trim();
        const label = (at > 0 ? line.slice(at + 1) : line).trim();
        const n = Number(value.replace(',', '.'));
        return { value: numeric && Number.isFinite(n) ? n : value, label };
      });
    }

    function create(ctx) {
      const { ui, store, shell, services } = ctx;
      const s = { id: null, form: null };
      let slots = null; let seq = 0; let saveTimer = 0;
      const fail = (err) => { const m = String((err && err.message) || err); shell.log(m, 'error'); ui.toast.show(m, { kind: 'error' }); };
      const tables = () => store.get().datasets.filter((d) => !d.kind || d.kind === 'table');

      /** @param {{center: HTMLElement, right: HTMLElement}} target */
      function render(target) {
        slots = target;
        if (!s.id) { const selected = store.get().selectedId; if (tables().some((d) => d.id === selected)) s.id = selected; }
        return draw();
      }
      async function flush() {
        clearTimeout(saveTimer); saveTimer = 0;
        if (s.id && s.form) await collect.save(s.id, s.form);
      }
      function destroy() { seq++; slots = null; if (saveTimer) flush().catch(fail); }
      /** The form is saved shortly after each change, so nothing is lost when the view is left. */
      function touch() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { flush().catch(fail); }, 500); }

      async function choose(id) {
        if (saveTimer) await flush();
        s.id = id || null; s.form = null;
        await draw();
      }
      async function draw() {
        if (!slots) return;
        const my = ++seq;
        const list = tables();
        if (s.id && !list.some((d) => d.id === s.id)) { s.id = null; s.form = null; }
        if (s.id && !s.form) s.form = await collect.formFor(s.id);
        const right = await inspector();
        if (my !== seq || !slots) return;
        const head = h('div', { class: 'dm-page-head' }, h('h1', null, ui.icon('smartphone', 20), t('field.title')));
        const pick = /** @type {any} */ (h('dm-select', { label: t('field.dataset') }));
        pick.options = [{ value: '', label: t('field.dataset.choose') }].concat(list.map((d) => ({ value: d.id, label: d.name })));
        pick.value = s.id || '';
        pick.addEventListener('change', () => { choose(pick.value).catch(fail); });
        const top = h('div', { class: 'dm-row-wrap' }, h('div', { class: 'dm-grow' }, pick), ui.button({ label: t('field.new.dataset'), icon: 'plus', title: t('field.new.dataset.hint'), onClick: () => newDataset().catch(fail) }));
        const body = s.form ? editor() : h('dm-empty-state', { icon: 'smartphone', heading: t('field.empty'), text: t('field.empty.hint') });
        replace(slots.center, head, h('p', { class: 'dm-help', text: t('field.about') }), top, body);
        replace(slots.right, ...right);
      }

      // ---- a new, empty dataset ---------------------------------------------------------------------------------
      async function newDataset() {
        const name = /** @type {any} */ (h('dm-input', { label: t('field.new.name') }));
        const columns = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '7', mono: true, label: t('field.new.columns'), help: t('field.new.columns.help', { types: ['text', 'integer', 'number', 'date', 'boolean'].map((x) => t('type.' + x).toLowerCase()).join(', ') }) }));
        const ok = await ui.dialog.open({ title: t('field.new.dataset'), help: 'insamling#formuläret', body: h('div', { class: 'dm-stack' }, name, columns), actions: [{ label: t('common.cancel'), value: false }, { label: t('field.new.create'), variant: 'primary', value: true, primary: true }] });
        if (ok !== true) return;
        const meta = await collect.createEmpty(name.value.trim() || t('field.new.default'), columns.value);
        s.id = meta.id; s.form = null;
        store.set({ selectedId: meta.id });
        await draw();
      }

      // ---- the form ---------------------------------------------------------------------------------------------
      function textInput(key, value, onChange, attrs = {}) {
        const input = /** @type {any} */ (h('dm-input', Object.assign({ label: t(key) }, attrs)));
        input.value = value === undefined || value === null ? '' : value;
        input.addEventListener('input', () => { onChange(input.value); touch(); });
        return input;
      }
      function choice(key, values, value, onChange, labelOf) {
        const sel = /** @type {any} */ (h('dm-select', { label: t(key) }));
        sel.options = values.map((v) => ({ value: String(v), label: labelOf(v) }));
        sel.value = String(value);
        sel.addEventListener('change', () => { onChange(sel.value); touch(); });
        return sel;
      }
      function toggle(key, on, onChange) {
        const sw = /** @type {any} */ (h('dm-switch', { label: t(key) }));
        sw.checked = !!on;
        sw.addEventListener('change', () => { onChange(sw.checked); touch(); });
        return sw;
      }
      /** The values in a column as choices: only on request, and shown in the box before anything is sent. */
      async function fillChoices(field, box) {
        const handle = await datasets.ensureOpen(s.id);
        const res = await handle.engine.exec(`select distinct ${q(field.name)} from data where ${q(field.name)} is not null and cast(${q(field.name)} as text) != '' order by 1 limit ${MAX_CHOICES + 1}`);
        const values = res[0] ? res[0].values.map((r) => r[0]) : [];
        if (!values.length) { ui.toast.show(t('field.field.choices.none'), { kind: 'info' }); return; }
        if (values.length > MAX_CHOICES) ui.toast.show(t('field.field.choices.many', { n: MAX_CHOICES }), { kind: 'warn' });
        field.options = values.slice(0, MAX_CHOICES).map((v) => ({ value: v, label: String(v) }));
        box.value = optionsText(field.options);
        touch();
      }
      function fieldRow(field) {
        const details = h('div', { class: 'dm-stack-sm' });
        details.hidden = field.include === false;
        const include = /** @type {any} */ (h('dm-switch', { label: field.name }));
        include.checked = field.include !== false;
        include.addEventListener('change', () => { field.include = include.checked; details.hidden = !include.checked; touch(); });
        const box = /** @type {any} */ (h('dm-input', { type: 'textarea', rows: '3', mono: true, label: t('field.field.choices'), help: t('field.field.choices.help') }));
        box.value = optionsText(field.options);
        box.addEventListener('input', () => { field.options = parseOptions(box.value, field.type); touch(); });
        details.append(
          textInput('field.field.label', field.label, (v) => { field.label = v.trim() || field.name; }),
          h('div', { class: 'dm-row-wrap' },
            toggle('field.field.required', field.required, (v) => { field.required = v; }),
            toggle('field.field.sticky', field.sticky, (v) => { field.sticky = v; }),
            field.type === 'text' ? toggle('field.field.long', field.long, (v) => { field.long = v; }) : null),
          field.type === 'boolean' ? h('span') : h('details', { class: 'dm-more' }, h('summary', { text: t('field.field.choices') }),
            h('div', { class: 'dm-stack-sm' }, box, h('div', null, ui.button({ label: t('field.field.fill'), icon: 'list', size: 'sm', title: t('field.field.fill.hint'), onClick: () => fillChoices(field, box).catch(fail) })))));
        return h('div', { class: 'dm-card dm-stack-sm dm-field-row', 'data-field': field.name },
          h('div', { class: 'dm-row' }, h('div', { class: 'dm-grow' }, include), h('dm-badge', { text: t('type.' + field.type) })), details);
      }
      function editor() {
        const form = s.form;
        const settings = h('div', { class: 'dm-card dm-stack-sm' },
          textInput('field.form.title', form.title, (v) => { form.title = v.trim() || form.datasetName; }),
          textInput('field.form.instructions', form.instructions, (v) => { form.instructions = v; }, { type: 'textarea', rows: '2', help: t('field.form.instructions.help') }),
          h('div', { class: 'dm-row-wrap' },
            choice('field.form.position', ['off', 'optional', 'required'], form.position, (v) => { form.position = v; }, (v) => t('field.level.' + v)),
            choice('field.form.photo', ['off', 'optional', 'required'], form.photo, (v) => { form.photo = v; }, (v) => t('field.level.' + v))),
          h('details', { class: 'dm-more' }, h('summary', { text: t('common.more') }),
            h('div', { class: 'dm-row-wrap' },
              choice('field.form.size', [2048, 1280, 0], form.photoMaxSide === undefined ? 2048 : form.photoMaxSide, (v) => { form.photoMaxSide = Number(v); }, (v) => t('field.size.' + v)),
              textInput('field.form.max', form.maxPhotos, (v) => { const n = Number(v); form.maxPhotos = Number.isInteger(n) && n > 0 ? Math.min(n, 20) : 5; }, { type: 'number', min: '1', max: '20' }))));
        const actions = h('div', { class: 'dm-row-wrap' },
          ui.button({ label: t('field.send.phone'), icon: 'smartphone', variant: 'primary', title: t('field.send.phone.hint'), onClick: () => sendToPhone().catch(fail) }),
          ui.button({ label: t('field.save.file'), icon: 'download', title: t('field.save.file.hint'), onClick: () => saveFile().catch(fail) }));
        return h('div', { class: 'dm-stack' }, settings, h('h4', { text: t('field.fields') }), form.fields.map(fieldRow), actions);
      }

      // ---- what leaves the computer ---------------------------------------------------------------------------
      /** Everything in the form the user is about to send. @returns {Promise<any|null>} the package, or null when cancelled */
      async function review() {
        if (!s.form.fields.some((f) => f.include !== false)) { ui.toast.show(t('field.err.nofields'), { kind: 'warn' }); return null; }
        const pack = await collect.packageForm(s.id, s.form);
        const compiled = pack.form;
        const choices = compiled.fields.filter((f) => f.options && f.options.length);
        const body = h('div', { class: 'dm-stack' },
          h('p', { text: t('field.review.text') }),
          h('ul', null, compiled.fields.map((f) => h('li', { text: f.label === f.name ? f.name : `${f.label} (${f.name})` }))),
          choices.length ? h('div', { class: 'dm-stack-xs' }, h('p', { class: 'dm-help', text: t('field.review.choices') }), h('ul', null, choices.map((f) => h('li', { class: 'dm-help', text: `${f.label}: ${f.options.map((o) => o.label).join(', ')}` })))) : null,
          compiled.rules.length ? h('p', { class: 'dm-help', text: t('field.review.rules', { n: i18n.formatNumber(compiled.rules.length) }) }) : null);
        const ok = await ui.dialog.open({ title: t('field.review.title'), help: 'insamling#formuläret', body, actions: [{ label: t('common.cancel'), value: false }, { label: t('field.review.go'), variant: 'primary', value: true, primary: true }] });
        return ok === true ? pack : null;
      }
      async function sendToPhone() {
        const pack = await review();
        if (!pack) return;
        store.set({ devicesPending: { name: pack.name, label: pack.form.title, blob: pack.blob, kind: 'field-form' }, delaTab: 'devices' });
        shell.activate('dela');
      }
      async function saveFile() {
        const pack = await review();
        if (!pack) return;
        services.files.download(pack.blob, pack.name);
        shell.log(t('field.saved.file', { name: pack.name }), 'ok');
      }

      // ---- inspector --------------------------------------------------------------------------------------------
      async function inspector() {
        const items = [h('h4', { text: t('field.steps') }), h('ol', { class: 'dm-stack-xs' }, ['1', '2', '3', '4'].map((n) => h('li', { class: 'dm-help', text: t('field.steps.' + n) })))];
        if (!s.id || !s.form) return items;
        try {
          const compiled = await collect.compile(s.id, s.form);
          items.push(h('h4', { text: t('field.rules') }), h('p', { class: 'dm-help', text: compiled.rules.length ? t('field.rules.phone', { n: i18n.formatNumber(compiled.rules.length) }) : t('field.rules.none') }));
          if (compiled.leftToComputer.length) items.push(h('p', { class: 'dm-help', text: t('field.rules.left') }), h('ul', null, compiled.leftToComputer.map((x) => h('li', { class: 'dm-help', text: x }))));
        } catch (err) { D.log('field', 'compile', err); }
        const handle = await datasets.ensureOpen(s.id);
        const field = handle.meta.field || {};
        const imports = (field.imports || []).slice().reverse();
        if (imports.length) {
          items.push(h('h4', { text: t('field.imports') }), h('ul', { class: 'dm-stack-xs' }, imports.slice(0, 8).map((x) => h('li', { class: 'dm-help', text: t('field.imports.row', { when: i18n.formatDateTime(x.at), device: x.device || t('p2p.device.phone'), n: i18n.formatNumber(x.rows), photos: i18n.formatNumber(x.photos) }) }))));
          items.push(h('div', { class: 'dm-row-wrap' }, ui.button({ label: t('field.open.table'), icon: 'table', size: 'sm', title: t('field.open.table.hint'), onClick: () => { store.set({ selectedId: s.id }); shell.activate('bearbeta'); } }),
            field.imagesId ? ui.button({ label: t('field.open.images'), icon: 'image', size: 'sm', title: t('field.open.images.hint'), onClick: () => { store.set({ selectedId: field.imagesId }); shell.activate('bearbeta'); } }) : null));
        }
        return items;
      }

      return { render, destroy, state: s, flush };
    }

    return { create, optionsText, parseOptions };
  });
})();
