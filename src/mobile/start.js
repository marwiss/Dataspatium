// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/** Starts Dataspatium Mobil when the boot loader is done (m/index.html). */
(function () {
  'use strict';
  var app = document.getElementById('app');
  document.addEventListener('dataspatium:ready', function () {
    globalThis.Dataspatium.require('mobile/app').start(app).catch(function (err) {
      console.error(err);
      app.textContent = 'Dataspatium Mobil kunde inte starta: ' + ((err && err.message) || err);
    });
  });
  document.addEventListener('dataspatium:boot-error', function (ev) {
    app.textContent = 'Dataspatium Mobil kunde inte starta: ' + /** @type {CustomEvent} */ (ev).detail;
  });
})();
