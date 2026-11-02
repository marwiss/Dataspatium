// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Command palette (Ctrl+K): one search box for modes, datasets, charts, dashboards and actions. Modes
 * contribute commands through providers registered with `register(() => commands)`; a command is
 * `{id, label, hint?, group?, icon?, keywords?, run}`. Recently run commands float to the top.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/command-palette', ['ui/base', 'ui/icons', 'platform/storage/idb'], (base, icons, idb) => {
    const { h, t, replace } = base;
    const RECENT = 'palette:recent';
    const MAX = 40;

    /** Match score: 0 = no match; prefix of the label beats a word start, which beats any substring. */
    function score(cmd, query) {
      const q = String(query || '').trim().toLocaleLowerCase('sv');
      if (!q) return 1;
      const label = String(cmd.label || '').toLocaleLowerCase('sv');
      const words = q.split(/\s+/).filter(Boolean);
      let total = 0;
      for (const w of words) {
        let s = 0;
        if (label.startsWith(w)) s = 4;
        else if (new RegExp('(^|[\\s/:(-])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(label)) s = 3;
        else if (label.includes(w)) s = 2;
        else if (String(cmd.hint || '').toLocaleLowerCase('sv').includes(w) || (cmd.keywords || []).some((k) => String(k).toLocaleLowerCase('sv').includes(w))) s = 1;
        if (!s) return 0;
        total += s;
      }
      return total;
    }

    /** @param {{log: Function}} shell */
    function create(shell) {
      const providers = [];
      let dlg = null; let input = null; let listEl = null;
      let items = []; let filtered = []; let active = 0;

      function register(provider) { providers.push(provider); return () => { const i = providers.indexOf(provider); if (i >= 0) providers.splice(i, 1); }; }

      async function collect() {
        const out = [];
        for (const provider of providers) {
          try { const list = await provider(); if (Array.isArray(list)) out.push(...list.filter((c) => c && c.id && c.label && typeof c.run === 'function')); } catch (err) { console.error(err); }
        }
        let recent = [];
        try { recent = (await idb.getSetting(RECENT, [])) || []; } catch (_err) { recent = []; }
        const rank = (c) => { const i = recent.indexOf(c.id); return i < 0 ? recent.length : i; };
        return out.sort((a, b) => rank(a) - rank(b));
      }

      function close() { if (!dlg) return; const d = dlg; dlg = null; input = null; listEl = null; try { d.close(); } catch (_e) { /* ignore */ } d.remove(); }

      async function open() {
        if (dlg) { close(); return; }
        items = await collect();
        dlg = h('dialog', { class: 'dm-dialog dm-palette', 'data-size': 'md', 'aria-label': t('palette.title') });
        input = h('input', { class: 'dm-palette-input', type: 'search', placeholder: t('palette.placeholder'), 'aria-label': t('palette.title'), autocomplete: 'off', spellcheck: 'false' });
        listEl = h('ul', { class: 'dm-palette-list', role: 'listbox', 'aria-label': t('palette.title') });
        dlg.append(h('div', { class: 'dm-palette-head' }, icons.icon('search', 16), input), listEl, h('p', { class: 'dm-palette-hint', text: t('palette.hint') }));
        input.addEventListener('input', () => update());
        input.addEventListener('keydown', onKey);
        dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
        dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
        document.body.appendChild(dlg);
        dlg.showModal();
        update();
        input.focus();
      }

      function update() {
        const q = input ? input.value : '';
        filtered = (q.trim() ? items.map((c) => ({ c, s: score(c, q) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.c) : items).slice(0, MAX);
        active = 0;
        renderList();
      }

      function renderList() {
        if (!listEl) return;
        replace(listEl, filtered.length
          ? filtered.map((c, i) => h('li', { role: 'option', class: 'dm-palette-item', id: 'dm-palette-opt-' + i, 'aria-selected': i === active ? 'true' : 'false', onclick: () => run(c), onmousemove: () => { if (active !== i) { active = i; renderList(); } } },
            icons.icon(c.icon || 'chevron-right', 16),
            h('span', { class: 'dm-list-main' }, h('span', { class: 'dm-truncate', text: c.label }), c.hint ? h('span', { class: 'dm-list-sub dm-truncate', text: c.hint }) : null),
            c.group ? h('span', { class: 'dm-palette-group', text: c.group }) : null))
          : h('li', { class: 'dm-palette-empty', text: t('palette.empty') }));
        const activeEl = listEl.children[active];
        if (activeEl && typeof activeEl.scrollIntoView === 'function') activeEl.scrollIntoView({ block: 'nearest' });
        if (input) input.setAttribute('aria-activedescendant', activeEl && filtered.length ? activeEl.id : '');
      }

      function onKey(e) {
        if (e.key === 'ArrowDown') { active = Math.min(filtered.length - 1, active + 1); renderList(); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); renderList(); e.preventDefault(); }
        else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) run(filtered[active]); }
        else if (e.key === 'Escape') { e.preventDefault(); close(); }
      }

      async function run(cmd) {
        close();
        try {
          const recent = ((await idb.getSetting(RECENT, [])) || []).filter((id) => id !== cmd.id);
          recent.unshift(cmd.id);
          await idb.setSetting(RECENT, recent.slice(0, 20));
        } catch (_err) { /* remembering is optional */ }
        try { await cmd.run(); } catch (err) { shell.log(String((err && err.message) || err), 'error'); }
      }

      return { open, close, register, collect, score, run, isOpen: () => !!dlg, current: () => filtered.slice() };
    }
    return { create, score };
  });
})();
