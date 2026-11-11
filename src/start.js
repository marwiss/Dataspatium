// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Starts the app when the boot loader is done (index.html); a script file, so that the page needs no inline script. */
(function () {
  'use strict';
  var app = document.getElementById('app');
  document.addEventListener('dataspatium:ready', function () {
    globalThis.Dataspatium.require('app').start(app).catch(function (err) {
      console.error(err);
      app.textContent = 'Dataspatium kunde inte starta: ' + ((err && err.message) || err);
    });
  });
  document.addEventListener('dataspatium:boot-error', function (ev) {
    app.textContent = 'Dataspatium kunde inte starta: ' + /** @type {CustomEvent} */ (ev).detail;
  });
})();
