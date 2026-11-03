// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Dataset dialogs used by the Bearbeta mode: operations palette, data-quality profile, versions,
 * recipe view, category clustering, column reordering and derived datasets (aggregate, join, append).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/dialogs', ['ui/base', 'ui/overlays', 'ui/basic', 'ui/op-dialog', 'data/operations', 'data/recipes', 'data/derive', 'data/profile', 'data/datasets', 'platform/files', 'data/rules'],
    (base, overlays, basic, opDialog, ops, recipes, derive, profileMod, datasets, files, rulesMod) => {
      const { h, t, i18n, replace } = base;
      const GROUPS = [
        { id: 'column', ops: ['rename_column', 'set_type', 'set_label', 'drop_columns', 'reorder_columns'] },
        { id: 'values', ops: ['replace_text', 'trim', 'change_case', 'fix_encoding', 'replace_value', 'fill_missing', 'pseudonymize'] },
        { id: 'rows', ops: ['delete_rows', 'remove_duplicates'] },
        { id: 'structure', ops: ['add_column', 'combine_columns', 'split_column', 'pivot_longer', 'pivot_wider', 'sql'] },
        { id: 'derive', ops: ['aggregate', 'join', 'append', 'clusters'] },
      ];

      /** Palette of all operations, grouped. Returns the chosen action id or null. */
      async function palette(ctx) {
        let chosen = null;
        const body = h('div', { class: 'dm-stack' }, GROUPS.map((g) => h('div', { class: 'dm-stack-sm' },
          h('h4', { text: t('op.group.' + g.id) }),
          h('div', { class: 'dm-op-grid' }, g.ops.map((id) => h('button', { type: 'button', class: 'dm-op-tile', 'data-op': id, onclick: () => { chosen = id; const dlg = body.closest('dialog'); if (dlg) dlg.querySelector('.dm-dialog-actions dm-button button').click(); } },
            h('strong', { text: t('op.' + id) }), h('span', { class: 'dm-help', text: i18n.has('op.' + id + '.help') ? t('op.' + id + '.help') : '' })))))));
        await overlays.dialog.open({ title: t('bearbeta.actions'), body, size: 'lg', actions: [{ label: t('common.cancel'), value: false }] });
        if (!chosen) return null;
        return run(ctx, chosen);
      }

      /** Run an action id: an in-place operation (via op-dialog) or a special dialog. */
      async function run(ctx, id, preset) {
        if (id === 'aggregate') return aggregateDialog(ctx);
        if (id === 'join') return joinDialog(ctx);
        if (id === 'append') return appendDialog(ctx);
        if (id === 'clusters') return clustersDialog(ctx, preset && preset.column);
        if (id === 'reorder_columns') return reorderDialog(ctx);
        return opDialog.open({ datasetId: ctx.datasetId, opId: id, preset, columns: ctx.columns, onApplied: ctx.onApplied });
      }

      async function reorderDialog(ctx) {
        let order = ctx.columns.map((c) => c.name);
        const list = h('div', { class: 'dm-list' });
        const render = () => replace(list, order.map((name, i) => h('div', { class: 'dm-list-item', style: { cursor: 'default' } },
          h('span', { class: 'dm-list-main', text: name }),
          basic.button({ label: '↑', size: 'sm', variant: 'ghost', disabled: i === 0, onClick: () => { [order[i - 1], order[i]] = [order[i], order[i - 1]]; render(); } }),
          basic.button({ label: '↓', size: 'sm', variant: 'ghost', disabled: i === order.length - 1, onClick: () => { [order[i + 1], order[i]] = [order[i], order[i + 1]]; render(); } }))));
        render();
        const ok = await overlays.dialog.open({ title: t('op.reorder_columns'), body: list, actions: [{ label: t('common.cancel'), value: false }, { label: t('op.apply'), variant: 'primary', value: true }] });
        if (ok !== true) return null;
        const result = await recipes.apply(ctx.datasetId, 'reorder_columns', { order });
        if (ctx.onApplied) ctx.onApplied(result, t('op.reorder_columns'));
        return result;
      }

      async function profileDialog(ctx) {
        const body = h('div', { class: 'dm-stack' }, h('p', { class: 'dm-help', text: t('common.loading') }));
        const dlg = overlays.dialog.open({ title: t('bearbeta.profile'), body, size: 'lg', actions: [{ label: t('common.close'), value: true }] });
        try {
          const prof = await profileMod.profile(ctx.datasetId);
          const rows = prof.columns.map((c) => h('tr', null,
            h('td', null, h('strong', { text: c.name }), h('div', { class: 'dm-help', text: t('type.' + c.type) })),
            h('td', { class: 'dm-num', text: i18n.formatNumber(c.nulls) + (c.missingShare ? ` (${i18n.formatNumber(c.missingShare * 100, { maximumFractionDigits: 1 })} %)` : '') }),
            h('td', { class: 'dm-num', text: i18n.formatNumber(c.distinct) + (c.unique ? ' ★' : '') }),
            h('td', { text: c.min === null || c.min === undefined ? '' : `${fmt(c.min)} – ${fmt(c.max)}` }),
            h('td', null, c.warnings.length ? h('ul', { class: 'dm-stack-sm' }, c.warnings.map((w) => h('li', { class: 'dm-row' },
              h('span', { class: 'dm-warn dm-small', text: t('profile.warn.' + w.kind, { n: i18n.formatNumber(w.count) }) }),
              w.op ? basic.button({ label: t('op.' + w.op), size: 'sm', onClick: () => { closeDialog(body); run(ctx, w.op, presetFor(w.op, c)); } }) : null))) : h('span', { class: 'dm-ok dm-small', text: t('profile.ok') }))));
          replace(body,
            h('div', { class: 'dm-stats-grid' }, stat(i18n.formatNumber(prof.rows), t('datasets.rows')), stat(String(prof.columns.length), t('datasets.columns')), stat(i18n.formatNumber(prof.duplicates), t('profile.duplicates'))),
            prof.duplicates ? h('div', null, basic.button({ label: t('op.remove_duplicates'), icon: 'rows-3', onClick: () => { closeDialog(body); run(ctx, 'remove_duplicates', {}); } })) : null,
            h('table', { class: 'dm-columns-table' }, h('thead', null, h('tr', null, h('th', { text: t('common.name') }), h('th', { text: t('table.stats.nulls') }), h('th', { text: t('table.stats.distinct') }), h('th', { text: t('profile.range') }), h('th', { text: t('profile.findings') }))), h('tbody', null, rows)));
        } catch (err) { replace(body, h('p', { class: 'dm-error', text: String((err && err.message) || err) })); }
        return dlg;
      }
      function presetFor(opId, col) {
        if (opId === 'trim' || opId === 'fix_encoding' || opId === 'change_case') return { columns: [col.name] };
        if (opId === 'set_type') return { column: col.name, type: col.warnings.some((w) => w.kind === 'dates_as_text') ? 'date' : 'number' };
        if (opId === 'replace_value') return { column: col.name, fromEmpty: true, toEmpty: true };
        return { column: col.name };
      }
      const fmt = (v) => (typeof v === 'number' ? i18n.formatNumber(v, { maximumFractionDigits: 3 }) : String(v));
      function stat(value, label) { return h('div', { class: 'dm-stat' }, h('span', { class: 'dm-stat-value', text: value }), h('span', { class: 'dm-stat-label', text: label })); }
      function closeDialog(node) { const dlg = node.closest('dialog'); if (dlg) { const btn = dlg.querySelector('.dm-dialog-actions dm-button button'); if (btn) btn.click(); } }

      /** Validation rules: list with results, run, suggestions, failing rows as a dataset, HTML report. */
      async function rulesDialog(ctx) {
        const body = h('div', { class: 'dm-stack' });
        const dlg = overlays.dialog.open({ title: t('rules.title'), body, size: 'lg', actions: [{ label: t('common.close'), value: true }] });
        let rules = await rulesMod.list(ctx.datasetId);
        let lastRun = null;
        const sel = (label, options, value, onPick) => { const s = /** @type {any} */ (h('dm-select', { label })); s.options = options; s.value = value; s.addEventListener('change', () => onPick(s.value)); return s; };
        async function exportReport() {
          const meta = await datasets.get(ctx.datasetId);
          const md = rulesMod.toMarkdown(lastRun, meta);
          const html = D.require('docgen/builders').toHtml(D.require('docgen/markdown').parse(md), { title: `Datakvalitetsrapport: ${meta ? meta.name : ''}` });
          const name = files.safeName(`datakvalitet ${meta ? meta.name : ''}`, 'html');
          files.download(new Blob([html], { type: 'text/html;charset=utf-8' }), name);
          overlays.toast.show(t('rules.report.done', { name }), { kind: 'ok' });
        }
        function ruleForm() {
          const values = { type: 'notnull' };
          const wrap = h('div', { class: 'dm-stack-sm' });
          const draw = () => {
            const fields = [sel(t('rules.type'), rulesMod.TYPES.map((ty) => ({ value: ty, label: t('rules.type.' + ty) })), values.type, (v) => { values.type = v; draw(); })];
            const input = (name, label, type, help) => { const el = /** @type {any} */ (h('dm-input', { type: type || 'text', label, help: help || '' })); el.value = values[name] === undefined ? '' : values[name]; el.addEventListener('input', () => { values[name] = el.value; }); return el; };
            if (values.type === 'unique') { values.columnsText = values.columnsText || (ctx.columns[0] ? ctx.columns[0].name : ''); fields.push(input('columnsText', t('rules.columns'), 'text', t('rules.columns.help'))); }
            else if (values.type !== 'sql') { values.column = values.column || (ctx.columns[0] ? ctx.columns[0].name : ''); fields.push(sel(t('rules.column'), ctx.columns.map((c) => ({ value: c.name, label: `${c.name} (${t('type.' + c.type)})` })), values.column, (v) => { values.column = v; })); }
            if (values.type === 'range' || values.type === 'length') fields.push(input('min', t('rules.min')), input('max', t('rules.max')));
            if (values.type === 'inset') fields.push(input('values', t('rules.values'), 'text', t('rules.values.help')));
            if (values.type === 'regex') fields.push(input('pattern', t('rules.pattern'), 'text', t('rules.pattern.help')));
            if (values.type === 'sql') fields.push(input('expression', t('rules.expression'), 'text', t('rules.expression.help')));
            replace(wrap, h('div', { class: 'dm-form-grid' }, fields), h('div', null, basic.button({ label: t('rules.add'), icon: 'plus', onClick: async () => {
              const rule = { type: values.type };
              if (values.type === 'unique') rule.columns = String(values.columnsText || '').split(/[,;+]/).map((s) => s.trim()).filter(Boolean);
              else if (values.type !== 'sql') rule.column = values.column;
              for (const k of ['min', 'max', 'values', 'pattern', 'expression']) if (values[k] !== undefined && values[k] !== '') rule[k] = values[k];
              if ((values.type === 'unique' && !rule.columns.length) || (values.type === 'sql' && !rule.expression) || (values.type === 'regex' && !rule.pattern) || (values.type === 'inset' && !rule.values)) { overlays.toast.show(t('op.missing', { fields: t('rules.type.' + values.type) }), { kind: 'warn' }); return; }
              await rulesMod.add(ctx.datasetId, rule);
              rules = await rulesMod.list(ctx.datasetId); lastRun = null; render();
            } })));
          };
          draw();
          return wrap;
        }
        const render = () => {
          replace(body,
            h('p', { class: 'dm-help', text: t('rules.help') }),
            h('div', { class: 'dm-row-wrap' },
              basic.button({ label: t('rules.run'), icon: 'play', variant: 'primary', disabled: !rules.length, onClick: async () => { lastRun = await rulesMod.run(ctx.datasetId, rules); render(); } }),
              basic.button({ label: t('rules.suggest'), icon: 'sparkles', onClick: async () => {
                const suggestions = await rulesMod.suggest(ctx.datasetId);
                let added = 0;
                for (const s of suggestions) {
                  if (rules.some((r) => r.type === s.type && (r.column || '') === (s.column || '') && JSON.stringify(r.columns || []) === JSON.stringify(s.columns || []))) continue;
                  rules.push(Object.assign({ id: 'rule_' + Math.random().toString(36).slice(2, 8) }, s)); added++;
                }
                await rulesMod.save(ctx.datasetId, rules);
                overlays.toast.show(t('rules.suggested', { n: added }), { kind: 'ok' });
                render();
              } }),
              lastRun ? basic.button({ label: t('rules.report'), icon: 'file-text', onClick: exportReport }) : null),
            rules.length ? h('table', { class: 'dm-columns-table' },
              h('thead', null, h('tr', null, h('th', { text: t('rules.rule') }), h('th', { text: t('rules.result') }), h('th', { text: t('rules.failures') }), h('th'))),
              h('tbody', null, rules.map((r) => {
                const res = lastRun && lastRun.results.find((x) => x.rule.id === r.id);
                return h('tr', null,
                  h('td', null, h('strong', { text: rulesMod.describe(r) }), h('div', { class: 'dm-help', text: t('rules.type.' + r.type) })),
                  h('td', null, res ? (res.error ? h('span', { class: 'dm-error dm-small', text: res.error }) : h('span', { class: res.ok ? 'dm-ok dm-small' : 'dm-warn dm-small', text: res.ok ? t('rules.ok') : t('rules.broken') })) : h('span', { class: 'dm-faint dm-small', text: t('rules.notrun') })),
                  h('td', { class: 'dm-num', text: res && res.failures !== null ? i18n.formatNumber(res.failures) + (res.failures ? ` (${i18n.formatNumber(res.share * 100, { maximumFractionDigits: 1 })} %)` : '') : '' }),
                  h('td', null, h('div', { class: 'dm-row' },
                    res && res.failures ? basic.button({ label: t('rules.failing.rows'), size: 'sm', onClick: async () => { const meta = await rulesMod.failingRows(ctx.datasetId, r); overlays.toast.show(t('rules.failing.created', { name: meta.name }), { kind: 'ok' }); if (ctx.onDerived) ctx.onDerived(meta); closeDialog(body); } }) : null,
                    basic.button({ label: t('common.delete'), icon: 'trash-2', size: 'sm', variant: 'ghost', 'icon-only': true, onClick: async () => { rules = await rulesMod.remove(ctx.datasetId, r.id); lastRun = null; render(); } }))));
              }))) : h('p', { class: 'dm-help', text: t('rules.none') }),
            h('h4', { text: t('rules.add') }), ruleForm());
        };
        render();
        return dlg;
      }

      async function versionsDialog(ctx) {
        const body = h('div', { class: 'dm-stack' });
        const render = async () => {
          const versions = await datasets.listVersions(ctx.datasetId);
          replace(body,
            h('div', { class: 'dm-row' }, basic.button({ label: t('versions.create'), icon: 'plus', variant: 'primary', onClick: async () => { const label = await overlays.dialog.prompt(t('versions.label'), { title: t('versions.create'), value: t('versions.default.label', { n: versions.length + 1 }) }); if (label === null) return; await datasets.snapshot(ctx.datasetId, label); overlays.toast.show(t('versions.created', { label }), { kind: 'ok' }); render(); } })),
            versions.length ? h('table', { class: 'dm-columns-table' }, h('thead', null, h('tr', null, h('th', { text: t('versions.label') }), h('th', { text: t('common.created') }), h('th', { text: t('datasets.rows') }), h('th', { text: t('common.size') }), h('th'))),
              h('tbody', null, versions.slice().reverse().map((v) => h('tr', null, h('td', { text: v.label }), h('td', { text: i18n.formatDateTime(v.ts) }), h('td', { class: 'dm-num', text: i18n.formatNumber(v.rowCount || 0) }), h('td', { text: i18n.formatBytes(v.byteSize || 0) }),
                h('td', null, h('div', { class: 'dm-row' },
                  basic.button({ label: t('versions.compare'), size: 'sm', onClick: async () => { const cmp = await datasets.compareVersion(ctx.datasetId, v.n); overlays.dialog.open({ title: t('versions.compare'), body: h('div', { class: 'dm-prose' }, h('p', { text: t('versions.compare.rows', { then: i18n.formatNumber(cmp.rowsThen), now: i18n.formatNumber(cmp.rowsNow) }) }), h('p', { text: t('versions.compare.added', { list: cmp.added.join(', ') || '–' }) }), h('p', { text: t('versions.compare.removed', { list: cmp.removed.join(', ') || '–' }) }), h('p', { text: t('versions.compare.retyped', { list: cmp.retyped.map((r) => `${r.name}: ${r.from} → ${r.to}`).join(', ') || '–' }) })) }); } }),
                  basic.button({ label: t('versions.restore'), size: 'sm', onClick: async () => { if (await overlays.dialog.confirm(t('versions.restore.confirm', { label: v.label }))) { await datasets.restoreVersion(ctx.datasetId, v.n); overlays.toast.show(t('versions.restored', { label: v.label }), { kind: 'ok' }); if (ctx.onApplied) ctx.onApplied({}, t('versions.restored', { label: v.label })); closeDialog(body); } } }),
                  basic.button({ label: t('common.delete'), size: 'sm', variant: 'ghost', icon: 'trash-2', 'icon-only': true, onClick: async () => { await datasets.deleteVersion(ctx.datasetId, v.n); render(); } })))))))
              : h('p', { class: 'dm-help', text: t('versions.empty') }));
        };
        await render();
        return overlays.dialog.open({ title: t('bearbeta.versions'), body, size: 'lg', actions: [{ label: t('common.close'), value: true }] });
      }

      async function recipeDialog(ctx) {
        const steps = await recipes.steps(ctx.datasetId);
        const list = steps.length ? h('ol', { class: 'dm-recipe-steps' }, steps.map((s) => h('li', null, h('span', { text: s.description }), h('span', { class: 'dm-help', text: ' · ' + i18n.formatDateTime(s.ts) })))) : h('p', { class: 'dm-help', text: t('recipe.empty') });
        const others = (await datasets.list()).filter((d) => d.id !== ctx.datasetId);
        const target = /** @type {any} */ (h('dm-select', { label: t('recipe.replay.target') }));
        target.options = others.map((d) => ({ value: d.id, label: d.name }));
        const body = h('div', { class: 'dm-stack' },
          list,
          h('div', { class: 'dm-row-wrap' },
            basic.button({ label: t('recipe.copy.r'), icon: 'copy', disabled: !steps.length, onClick: async () => { await navigator.clipboard.writeText(await recipes.toR(ctx.datasetId)); overlays.toast.show(t('common.copied'), { kind: 'ok' }); } }),
            basic.button({ label: t('recipe.copy.sql'), icon: 'copy', disabled: !steps.length, onClick: async () => { await navigator.clipboard.writeText(await recipes.toSQL(ctx.datasetId)); overlays.toast.show(t('common.copied'), { kind: 'ok' }); } }),
            basic.button({ label: t('recipe.download'), icon: 'download', disabled: !steps.length, onClick: async () => { const meta = await datasets.get(ctx.datasetId); files.download(new Blob([recipes.exportJson(steps, meta ? meta.name : '')], { type: 'application/json' }), files.safeName((meta ? meta.name : 'recept') + ' recept', 'recipe.json')); } })),
          others.length && steps.length ? h('div', { class: 'dm-row' }, target, basic.button({ label: t('recipe.replay'), icon: 'play', onClick: async () => { const res = await recipes.replay(target.value, steps); const failed = res.filter((r) => !r.ok); overlays.toast.show(failed.length ? t('recipe.replay.partial', { done: res.length - failed.length, total: steps.length, error: failed[0].error }) : t('recipe.replay.done', { n: res.length }), { kind: failed.length ? 'warn' : 'ok', timeout: 8000 }); } })) : null,
          h('div', { class: 'dm-row' }, basic.button({ label: t('recipe.import'), icon: 'upload', onClick: async () => { const [file] = await files.pick({ accept: '.json' }); if (!file) return; try { const data = JSON.parse(await file.text()); const res = await recipes.replay(ctx.datasetId, data.steps || []); const failed = res.filter((r) => !r.ok); overlays.toast.show(failed.length ? t('recipe.replay.partial', { done: res.length - failed.length, total: (data.steps || []).length, error: failed[0].error }) : t('recipe.replay.done', { n: res.length }), { kind: failed.length ? 'warn' : 'ok', timeout: 8000 }); if (ctx.onApplied) ctx.onApplied({}, t('recipe.import')); closeDialog(body); } catch (err) { overlays.toast.show(String((err && err.message) || err), { kind: 'error' }); } } })));
        return overlays.dialog.open({ title: t('bearbeta.recipe'), body, size: 'lg', actions: [{ label: t('common.close'), value: true }] });
      }

      async function clustersDialog(ctx, presetColumn) {
        const textCols = ctx.columns.filter((c) => c.type === 'text');
        if (!textCols.length) { overlays.toast.show(t('clusters.no.text'), { kind: 'warn' }); return null; }
        const sel = /** @type {any} */ (h('dm-select', { label: t('param.column') }));
        sel.options = textCols.map((c) => ({ value: c.name, label: c.name }));
        sel.value = presetColumn && textCols.some((c) => c.name === presetColumn) ? presetColumn : textCols[0].name;
        const list = h('div', { class: 'dm-stack' });
        let groups = [];
        const load = async () => {
          replace(list, h('p', { class: 'dm-help', text: t('common.loading') }));
          groups = await derive.clusters(ctx.datasetId, sel.value);
          if (!groups.length) { replace(list, h('p', { class: 'dm-help', text: t('clusters.none') })); return; }
          replace(list, groups.map((g, gi) => {
            const input = /** @type {any} */ (h('dm-input', { 'aria-label': t('clusters.target') }));
            input.value = g.suggested; g.target = g.suggested; g.merge = true;
            input.addEventListener('input', () => { g.target = input.value; });
            const sw = /** @type {any} */ (h('dm-switch', { label: t('clusters.merge') })); sw.checked = true; sw.addEventListener('change', () => { g.merge = sw.checked; });
            return h('div', { class: 'dm-card dm-stack-sm' },
              h('div', { class: 'dm-row' }, h('strong', { text: t('clusters.group', { n: gi + 1, total: i18n.formatNumber(g.total) }) }), sw),
              h('ul', { class: 'dm-top-values' }, g.values.map((v) => h('li', null, h('span', { text: JSON.stringify(v.value) }), h('span', { class: 'dm-muted dm-num', text: i18n.formatNumber(v.count) })))),
              h('div', { class: 'dm-row' }, h('span', { class: 'dm-small', text: t('clusters.target') }), input));
          }));
        };
        sel.addEventListener('change', load);
        await load();
        const body = h('div', { class: 'dm-stack' }, h('p', { class: 'dm-help', text: t('clusters.help') }), sel, list);
        const ok = await overlays.dialog.open({ title: t('op.clusters'), body, size: 'lg', actions: [{ label: t('common.cancel'), value: false }, { label: t('op.apply'), variant: 'primary', value: true }] });
        if (ok !== true) return null;
        let changed = 0;
        for (const g of groups) {
          if (!g.merge || !g.target) continue;
          for (const v of g.values) if (v.value !== g.target) { const r = await recipes.apply(ctx.datasetId, 'replace_value', { column: sel.value, from: v.value, to: g.target }); changed += r.rows || 0; }
        }
        overlays.toast.show(t('clusters.done', { n: i18n.formatNumber(changed) }), { kind: 'ok' });
        if (ctx.onApplied) ctx.onApplied({ rows: changed }, t('op.clusters'));
        return { rows: changed };
      }

      async function aggregateDialog(ctx) {
        const cols = ctx.columns;
        const groupSet = new Set();
        const groupBoxes = cols.map((c) => { const sw = /** @type {any} */ (h('dm-switch', { label: c.name })); sw.addEventListener('change', () => { if (sw.checked) groupSet.add(c.name); else groupSet.delete(c.name); }); return sw; });
        const aggRows = [];
        const aggList = h('div', { class: 'dm-stack-sm' });
        const addAgg = () => {
          const colSel = /** @type {any} */ (h('dm-select', { 'aria-label': t('param.column') })); colSel.options = [{ value: '', label: t('aggregate.all.rows') }].concat(cols.map((c) => ({ value: c.name, label: c.name })));
          const fnSel = /** @type {any} */ (h('dm-select', { 'aria-label': t('aggregate.fn') })); fnSel.options = derive.AGG_FUNCTIONS.map((f) => ({ value: f, label: t('agg.' + f) })); fnSel.value = 'sum';
          const alias = /** @type {any} */ (h('dm-input', { placeholder: t('aggregate.alias'), 'aria-label': t('aggregate.alias') }));
          const row = h('div', { class: 'dm-row' }, fnSel, colSel, alias, basic.button({ label: t('common.delete'), icon: 'x', 'icon-only': true, variant: 'ghost', size: 'sm', onClick: () => { aggList.removeChild(row); aggRows.splice(aggRows.indexOf(entry), 1); } }));
          const entry = { colSel, fnSel, alias }; aggRows.push(entry); aggList.appendChild(row);
        };
        addAgg();
        const name = /** @type {any} */ (h('dm-input', { label: t('derive.name'), value: t('aggregate.default.name') }));
        const body = h('div', { class: 'dm-stack' },
          h('p', { class: 'dm-help', text: t('aggregate.help') }),
          h('div', { class: 'dm-stack-sm' }, h('span', { class: 'dm-label', text: t('aggregate.groupby') }), h('div', { class: 'dm-columns-pick' }, groupBoxes)),
          h('div', { class: 'dm-stack-sm' }, h('span', { class: 'dm-label', text: t('aggregate.aggregations') }), aggList, h('div', null, basic.button({ label: t('aggregate.add'), icon: 'plus', size: 'sm', onClick: addAgg }))),
          name);
        const ok = await overlays.dialog.open({ title: t('op.aggregate'), body, size: 'lg', actions: [{ label: t('common.cancel'), value: false }, { label: t('derive.create'), variant: 'primary', value: true }] });
        if (ok !== true) return null;
        try {
          const meta = await derive.aggregate(ctx.datasetId, { groupBy: cols.map((c) => c.name).filter((n) => groupSet.has(n)), aggregations: aggRows.map((e) => ({ column: e.colSel.value || undefined, fn: e.fnSel.value, as: e.alias.value.trim() || undefined })), name: name.value.trim() });
          overlays.toast.show(t('derive.created', { name: meta.name, rows: i18n.formatNumber(meta.rowCount) }), { kind: 'ok' });
          if (ctx.onDerived) ctx.onDerived(meta);
          return meta;
        } catch (err) { overlays.toast.show(String((err && err.message) || err), { kind: 'error' }); return null; }
      }

      async function joinDialog(ctx) {
        const others = (await datasets.list()).filter((d) => d.id !== ctx.datasetId);
        if (!others.length) { overlays.toast.show(t('join.no.other'), { kind: 'warn' }); return null; }
        const otherSel = /** @type {any} */ (h('dm-select', { label: t('join.other') }));
        otherSel.options = others.map((d) => ({ value: d.id, label: d.name }));
        otherSel.value = others[0].id; // dm-select has no value before it is connected unless set explicitly
        const leftKey = /** @type {any} */ (h('dm-select', { label: t('join.left.key') })); leftKey.options = ctx.columns.map((c) => ({ value: c.name, label: c.name }));
        leftKey.value = ctx.columns[0].name;
        const rightKey = /** @type {any} */ (h('dm-select', { label: t('join.right.key') }));
        const typeSel = /** @type {any} */ (h('dm-select', { label: t('join.type') })); typeSel.options = [{ value: 'left', label: t('join.type.left') }, { value: 'inner', label: t('join.type.inner') }];
        const name = /** @type {any} */ (h('dm-input', { label: t('derive.name'), value: t('join.default.name') }));
        const fillRight = async () => {
          if (!otherSel.value) return;
          const cols = await datasets.columns(otherSel.value);
          rightKey.options = cols.map((c) => ({ value: c.name, label: c.name }));
          const same = cols.find((c) => c.name === leftKey.value);
          rightKey.value = same ? same.name : (cols[0] ? cols[0].name : '');
        };
        otherSel.addEventListener('change', fillRight); leftKey.addEventListener('change', fillRight);
        await fillRight();
        const body = h('div', { class: 'dm-stack' }, h('p', { class: 'dm-help', text: t('join.help') }), h('div', { class: 'dm-form-grid' }, otherSel, typeSel, leftKey, rightKey, name));
        const ok = await overlays.dialog.open({ title: t('op.join'), body, size: 'lg', actions: [{ label: t('common.cancel'), value: false }, { label: t('derive.create'), variant: 'primary', value: true }] });
        if (ok !== true) return null;
        try {
          const meta = await derive.join(ctx.datasetId, otherSel.value, { keys: [[leftKey.value, rightKey.value]], type: typeSel.value, name: name.value.trim() });
          overlays.toast.show(t('derive.created', { name: meta.name, rows: i18n.formatNumber(meta.rowCount) }), { kind: 'ok' });
          if (ctx.onDerived) ctx.onDerived(meta);
          return meta;
        } catch (err) { overlays.toast.show(String((err && err.message) || err), { kind: 'error' }); return null; }
      }

      async function appendDialog(ctx) {
        const others = (await datasets.list()).filter((d) => d.id !== ctx.datasetId);
        if (!others.length) { overlays.toast.show(t('join.no.other'), { kind: 'warn' }); return null; }
        const chosen = new Set();
        const boxes = others.map((d) => { const sw = /** @type {any} */ (h('dm-switch', { label: `${d.name} (${t('common.rows', { n: i18n.formatNumber(d.rowCount || 0) })})` })); sw.addEventListener('change', () => { if (sw.checked) chosen.add(d.id); else chosen.delete(d.id); }); return sw; });
        const name = /** @type {any} */ (h('dm-input', { label: t('derive.name'), value: t('append.default.name') }));
        const body = h('div', { class: 'dm-stack' }, h('p', { class: 'dm-help', text: t('append.help') }), h('div', { class: 'dm-columns-pick' }, boxes), name);
        const ok = await overlays.dialog.open({ title: t('op.append'), body, size: 'lg', actions: [{ label: t('common.cancel'), value: false }, { label: t('derive.create'), variant: 'primary', value: true }] });
        if (ok !== true || !chosen.size) return null;
        try {
          const meta = await derive.append([ctx.datasetId].concat(others.map((d) => d.id).filter((id) => chosen.has(id))), name.value.trim());
          overlays.toast.show(t('derive.created', { name: meta.name, rows: i18n.formatNumber(meta.rowCount) }), { kind: 'ok' });
          if (ctx.onDerived) ctx.onDerived(meta);
          return meta;
        } catch (err) { overlays.toast.show(String((err && err.message) || err), { kind: 'error' }); return null; }
      }

      return { palette, run, profileDialog, rulesDialog, versionsDialog, recipeDialog, clustersDialog, aggregateDialog, joinDialog, appendDialog, reorderDialog, GROUPS };
    });
})();
