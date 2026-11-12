// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** A mode in a group of its own, tests-route, reached by a deep link (tests/groups.test.js). */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.require('tests/groups/support').log.push('mode-route');
  D.define('tests/groups/mode-route', ['tests/groups/support'], (support) => support.fakeMode('tests-route'));
})();
