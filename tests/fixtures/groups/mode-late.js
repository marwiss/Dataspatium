// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** A mode in a group of its own, tests-late, left before its group has run (tests/groups.test.js). */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.require('tests/groups/support').log.push('mode-late');
  D.define('tests/groups/mode-late', ['tests/groups/support'], (support) => support.fakeMode('tests-late'));
})();
