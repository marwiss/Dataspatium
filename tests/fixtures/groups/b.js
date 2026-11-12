// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** The script of the tests' group tests-b, which needs tests-a (tests/groups.test.js): notes that it ran. */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.require('tests/groups/support').log.push('b');
  D.define('tests/groups/b', ['tests/groups/a2'], (a2) => ({ name: 'b', after: a2.name }));
})();
