// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** A mode in a group of its own, tests-lazy (tests/groups.test.js). */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.require('tests/groups/support').log.push('mode-lazy');
  D.define('tests/groups/mode-lazy', ['tests/groups/support'], (support) => support.fakeMode('tests-lazy'));
})();
