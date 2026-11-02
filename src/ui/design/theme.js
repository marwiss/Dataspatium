// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Theme handling: "auto" follows the system, "light" and "dark" are explicit. The choice is a
 * per-browser convenience stored in localStorage (wrapped in try/catch: storage may be unavailable).
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('ui/theme', [], () => {
    const KEY = 'dataspatium.theme';
    const ORDER = ['auto', 'light', 'dark'];
    /** @type {Set<(theme: string) => void>} */
    const listeners = new Set();

    function get() {
      try { return localStorage.getItem(KEY) || 'auto'; } catch (_e) { return 'auto'; }
    }
    function apply(theme) {
      const root = document.documentElement;
      if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
      else root.removeAttribute('data-theme');
      for (const fn of listeners) fn(theme);
    }
    function set(theme) {
      if (!ORDER.includes(theme)) theme = 'auto';
      try { localStorage.setItem(KEY, theme); } catch (_e) { /* ignore */ }
      apply(theme);
    }
    function cycle() { set(ORDER[(ORDER.indexOf(get()) + 1) % ORDER.length]); return get(); }
    /** Effective theme after resolving "auto". */
    function effective() {
      const t = get();
      if (t !== 'auto') return t;
      return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
    apply(get());
    return { get, set, cycle, effective, onChange, ORDER };
  });
})();
