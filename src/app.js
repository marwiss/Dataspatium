// @ts-check
// SPDX-License-Identifier: LicenseRef-PolyForm-Strict-1.0.0
/**
 * Application entry point: loads fonts, builds the shell and registers the six modes.
 */
(function () {
  'use strict';
  const D = globalThis.Dataspatium;
  D.define('app', ['ui/shell', 'ui/fonts', 'ui/theme', 'ui/modes/inhamta', 'ui/modes/hantera', 'ui/modes/bearbeta', 'ui/modes/analysera', 'ui/modes/visualisera', 'ui/modes/exportera'],
    (shellMod, fonts, _theme, inhamta, hantera, bearbeta, analysera, visualisera, exportera) => ({
      /** @param {HTMLElement} root */
      async start(root) {
        fonts.loadFonts();
        const shell = shellMod.create(root);
        shell.registerMode(inhamta.createMode(shell.ctx));
        shell.registerMode(hantera.createMode(shell.ctx));
        shell.registerMode(bearbeta.createMode(shell.ctx));
        shell.registerMode(analysera.createMode(shell.ctx));
        shell.registerMode(visualisera.createMode(shell.ctx));
        shell.registerMode(exportera.createMode(shell.ctx));
        await shell.init();
        // Resume auto-save to the portable folder when it was on (Chromium only, see data/workspace.js).
        D.require('data/workspace').initFolder().catch((err) => D.log('folder', 'init failed', err));
        // Exposed on the Dataspatium namespace for debugging and for tools/screenshot.ps1 -EvalFile scripts.
        D.shell = shell;
        shell.log(D.t('app.started', { version: D.version, protocol: location.protocol }));
        return shell;
      },
    }));
})();
