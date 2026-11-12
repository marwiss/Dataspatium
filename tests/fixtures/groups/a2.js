// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** The second script of the tests' group tests-a (tests/groups.test.js): notes that it ran; defining twice would throw. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.require('tests/groups/support').log.push('a2');
  D.define('tests/groups/a2', ['tests/groups/a1'], (a1) => ({ name: 'a2', after: a1.name }));
})();
