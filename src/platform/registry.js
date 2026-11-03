// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Minimal module registry for classic scripts.
 *
 * Every source file registers itself with `Dataspatium.define(name, deps, factory)`; consumers call
 * `Dataspatium.require(name)`. Factories run lazily on first require, so script load order only matters
 * for code that runs at load time (which should be limited to the platform layer).
 */
(function () {
  'use strict';
  /** @type {Map<string, {deps: string[], factory: Function, exports: any, state: 'defined'|'loading'|'ready'}>} */
  const modules = new Map();
  const Dataspatium = globalThis.Dataspatium || (globalThis.Dataspatium = {});
  Dataspatium.version = '1.11.2';

  /**
   * Register a module.
   * @param {string} name
   * @param {string[]|Function} deps dependency names, or the factory when there are none
   * @param {Function} [factory] receives resolved dependencies, returns the module exports
   */
  Dataspatium.define = function define(name, deps, factory) {
    if (typeof deps === 'function') { factory = deps; deps = []; }
    if (modules.has(name)) throw new Error('Module already defined: ' + name);
    if (typeof factory !== 'function') throw new Error('Module factory missing: ' + name);
    modules.set(name, { deps: /** @type {string[]} */ (deps), factory, exports: undefined, state: 'defined' });
  };

  /**
   * Resolve a module, instantiating it and its dependencies on first use.
   * @param {string} name
   */
  Dataspatium.require = function require(name) {
    const m = modules.get(name);
    if (!m) throw new Error('Unknown module: ' + name);
    if (m.state === 'ready') return m.exports;
    if (m.state === 'loading') throw new Error('Circular dependency while loading ' + name);
    m.state = 'loading';
    const resolved = m.deps.map((d) => Dataspatium.require(d));
    m.exports = m.factory(...resolved) || {};
    m.state = 'ready';
    return m.exports;
  };

  Dataspatium.has = (name) => modules.has(name);
  Dataspatium.moduleNames = () => Array.from(modules.keys());

  /** Debug logging with a scope prefix; silent unless Dataspatium.debug is true. */
  Dataspatium.debug = /[?&]debug=1/.test(globalThis.location ? location.search : '');
  Dataspatium.log = function log(scope, ...args) {
    if (Dataspatium.debug) console.debug('[' + scope + ']', ...args);
  };
})();
